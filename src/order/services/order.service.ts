import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Order, OrderStatus, PaymentStatus } from '../entities/order.entity';

import { CacheService } from 'src/cache/cache.service';
import { DeliveryService } from 'src/delivery/delivery.service';
import { EscrowService } from 'src/escrow/escrow.service';
import { TransactionsService } from 'src/transactions/transactions.service';
import { StoreService } from 'src/store/store.service';
import { PaystackService } from 'src/common/services/paystack.service';
import { OrderMailService } from 'src/email/services/order-mail.service';
import { ICartItem } from 'src/cart/types/types';
import { ProductService } from 'src/product/product.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    private readonly deliveryService: DeliveryService,
    private readonly escrowService: EscrowService,
    private readonly transactions: TransactionsService,
    private readonly storeService: StoreService,
    private readonly paystack: PaystackService,
    private readonly mail: OrderMailService,
    private readonly cache: CacheService,
    private readonly productService: ProductService,
  ) {}

  /* ────────────────────────────────────────────────
     VALIDATE & BUILD ORDER ITEMS
  ──────────────────────────────────────────────── */
  private async buildOrderItems(order_items: ICartItem[]) {
    if (!order_items || order_items.length === 0) {
      throw new BadRequestException('Order items are required');
    }

    let subtotal = 0;
    const validated: ICartItem[] = [];

    for (const item of order_items) {
      const { product } = await this.productService.getSingle(item.product_id);

      if (!product) {
        throw new BadRequestException(`Product not found: ${item.product_id}`);
      }

      if (item.quantity < 1 || item.quantity > product.stock) {
        throw new BadRequestException(`Invalid quantity for ${product.name}`);
      }

      const price = product.discount_price ?? product.price;
      subtotal += price * item.quantity;

      validated.push({
        product_id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        discount_price: product.discount_price,
        image: product.image?.url ?? null,
        quantity: item.quantity,
        size: item.size ?? null,
        color: item.color ?? null,
        shipping_cost: product.shipping_cost ?? null,
      });
    }

    return { validatedItems: validated, subtotal };
  }

  async getByPaymentReference(reference: string) {
    return this.orderRepo.findOne({
      where: { payment_reference: reference },
      relations: ['buyer'],
    });
  }

  async markPaid(orderId: string) {
    await this.orderRepo.update(orderId, {
      payment_status: 'success',
      status: 'paid',
    });
  }

  async markCompleted(orderId: string) {
    await this.orderRepo.update(orderId, {
      status: 'completed',
    });
  }

  /* ────────────────────────────────────────────────
     CREATE OFFLINE ORDER (MULTI-VENDOR)
  ──────────────────────────────────────────────── */
  async createOfflineOrder(data: {
    buyer_id: string;
    order_items: ICartItem[];
    tax?: number;
    notes?: string;
  }) {
    const { buyer_id, order_items, tax = 0, notes } = data;

    const { validatedItems } = await this.buildOrderItems(order_items);

    const groups: Record<string, ICartItem[]> = {};
    for (const item of validatedItems) {
      const { product } = await this.productService.getSingle(item.product_id);

      if (!groups[product!.vendor_id]) {
        groups[product!.vendor_id] = [];
      }
      groups[product!.vendor_id].push(item);
    }

    const orders: Order[] = [];

    for (const vendor_id of Object.keys(groups)) {
      const vendorItems = groups[vendor_id];

      let subtotal = 0;
      for (const i of vendorItems) {
        subtotal += (i.discount_price ?? i.price) * i.quantity;
      }

      const total = subtotal + tax;

      const order = this.orderRepo.create({
        id: uuidv4(),
        buyer_id,
        vendor_id,
        order_items: vendorItems,
        subtotal,
        tax,
        total,
        payment_method: 'offline',
        payment_status: 'unpaid',
        status: 'pending',
        notes: notes ?? null,
      });

      const saved = await this.orderRepo.save(order);
      orders.push(saved);

      await this.transactions.create({
        order_id: saved.id,
        user_id: buyer_id,
        vendor_id,
        type: 'order_created',
        amount: total,
        currency: 'NGN',
        status: 'pending',
        description: 'Offline order created',
      });

      const delivery = await this.deliveryService.createDelivery({
        order_id: saved.id,
        buyer_id,
        vendor_id,
      });

      await this.orderRepo.update(saved.id, {
        delivery_id: delivery.id,
      });
    }

    await this.cache.clearPrefix('svc:order');

    return {
      success: true,
      orders,
    };
  }

  /* ────────────────────────────────────────────────
     CREATE ONLINE ORDER (PAYSTACK)
  ──────────────────────────────────────────────── */
  async createOnlineOrder(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
  }) {
    const { buyer_id, email, order_items } = data;

    const { validatedItems } = await this.buildOrderItems(order_items);

    const groups: Record<string, ICartItem[]> = {};
    for (const item of validatedItems) {
      const { product } = await this.productService.getSingle(item.product_id);

      if (!groups[product!.vendor_id]) {
        groups[product!.vendor_id] = [];
      }
      groups[product!.vendor_id].push(item);
    }

    const successfulOrders: any[] = [];
    const failedVendors: any[] = [];

    for (const vendor_id of Object.keys(groups)) {
      try {
        await this.storeService.validateVendorForOnline(vendor_id);

        const items = groups[vendor_id];
        let subtotal = 0;
        for (const i of items) {
          subtotal += (i.discount_price ?? i.price) * i.quantity;
        }

        const payment = await this.paystack.initializePayment(email, subtotal);

        const order = this.orderRepo.create({
          id: uuidv4(),
          buyer_id,
          vendor_id,
          order_items: items,
          subtotal,
          total: subtotal,
          payment_method: 'online',
          payment_reference: payment.reference,
          payment_url: payment.authorization_url,
          payment_access_code: payment.access_code,
          payment_status: 'pending',
          status: 'pending',
        });

        const saved = await this.orderRepo.save(order);

        const escrow = await this.escrowService.createEscrow({
          order_id: saved.id,
          buyer_id,
          vendor_id,
          amount: subtotal,
        });

        await this.orderRepo.update(saved.id, {
          escrow_id: escrow.id,
        });

        successfulOrders.push({
          order: saved,
          payment_url: payment.authorization_url,
        });
      } catch (err: any) {
        failedVendors.push({
          vendor_id,
          error: err.message,
        });
      }
    }

    await this.cache.clearPrefix('svc:order');

    return {
      success: true,
      successfulOrders,
      failedVendors,
    };
  }

  /* ────────────────────────────────────────────────
     VERIFY PAYMENT
  ──────────────────────────────────────────────── */
  async verifyPayment(reference: string) {
    const order = await this.orderRepo.findOne({
      where: { payment_reference: reference },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.payment_status === 'success') {
      return {
        success: true,
        idempotent: true,
        order,
      };
    }

    const verification = await this.paystack.verifyPayment(reference);

    if (verification.status !== 'success') {
      throw new BadRequestException('Payment verification failed');
    }

    await this.orderRepo.update(order.id, {
      payment_status: 'success',
      status: 'paid',
    });

    await this.escrowService.fundEscrow(order.escrow_id!);

    await this.deliveryService.createDelivery({
      order_id: order.id,
      buyer_id: order.buyer_id,
      vendor_id: order.vendor_id,
    });

    await this.cache.clearPrefix('svc:order');

    return {
      success: true,
      message: 'Payment verified',
      order,
    };
  }

  /* ────────────────────────────────────────────────
     GET ORDERS
  ──────────────────────────────────────────────── */
  async getOrder(id: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getOrdersByUser(buyer_id: string) {
    return this.orderRepo.find({ where: { buyer_id } });
  }

  async getOrdersByVendor(vendor_id: string) {
    return this.orderRepo.find({ where: { vendor_id } });
  }

  /* ────────────────────────────────────────────────
     UPDATE ORDER STATUS
  ──────────────────────────────────────────────── */
  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await this.getOrder(id);

    await this.orderRepo.update(id, { status });

    if (status === 'delivered' && order.payment_method === 'online') {
      await this.escrowService.markDelivered(order.id);
    }

    await this.cache.clearPrefix('svc:order');
    return { success: true };
  }

  /* ────────────────────────────────────────────────
     CANCEL ORDER
  ──────────────────────────────────────────────── */
  async cancelOrder(id: string, requestedBy: string) {
    const order = await this.getOrder(id);

    if (requestedBy !== order.buyer_id && requestedBy !== order.vendor_id) {
      throw new BadRequestException('Unauthorized');
    }

    if (['delivered', 'completed'].includes(order.status)) {
      throw new BadRequestException('Completed orders cannot be canceled');
    }

    await this.orderRepo.update(id, { status: 'canceled' });

    if (order.escrow_id && order.payment_method === 'online') {
      await this.escrowService.refundEscrow(order.escrow_id, requestedBy);
    }

    await this.cache.clearPrefix('svc:order');

    return { success: true };
  }
}
