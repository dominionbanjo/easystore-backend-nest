import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderStatus, PaymentStatus } from '../entities/order.entity';
import { DeliveryService } from '../../delivery/delivery.service';
import { PaystackService } from 'src/common/services/paystack.service';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { TransactionsService } from 'src/modules/finance-module/transactions/transactions.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { OrderMailService } from 'src/modules/shared-module/email/services/order-mail.service';
import { ICartItem } from '../../cart/types/types';
import { ProductService } from '../../product/services/product.service';
import { PandascrowEscrowService } from './pandascrow-escrow.service';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { StoreService } from 'src/modules/vendor-module/store/services/store.service';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly deliveryService: DeliveryService,
    private readonly escrowService: EscrowService,
    private readonly pandascrowEscrow: PandascrowEscrowService,
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

  async getOrdersByPaymentReference(reference: string) {
    return this.orderRepo.find({
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
   CREATE ORDER (PANDASCROW ONE-TIME ESCROW)
──────────────────────────────────────────────── */
  async createPandaEscrowOrder(data: {
    buyer_id: string;
    order_items: ICartItem[];
  }) {
    const { buyer_id, order_items } = data;

    /* BUYER */
    const buyer = await this.userRepo.findOne({ where: { id: buyer_id } });
    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    const { validatedItems } = await this.buildOrderItems(order_items);

    /* GROUP ITEMS BY VENDOR */
    const groups: Record<string, ICartItem[]> = {};
    for (const item of validatedItems) {
      const { product } = await this.productService.getSingle(item.product_id);
      if (!groups[product.vendor_id]) {
        groups[product.vendor_id] = [];
      }
      groups[product.vendor_id].push(item);
    }

    const orders: Order[] = [];

    for (const vendor_id of Object.keys(groups)) {
      /* VENDOR */
      const vendor = await this.userRepo.findOne({ where: { id: vendor_id } });
      if (!vendor) {
        throw new NotFoundException('Vendor not found');
      }

      const items = groups[vendor_id];

      /* CALCULATE SUBTOTAL */
      let subtotal = 0;
      for (const item of items) {
        subtotal += (item.discount_price ?? item.price) * item.quantity;
      }

      /* INIT PANDASCROW ESCROW (DOC-CORRECT) */
      const escrowResponse = await this.pandascrowEscrow.initializeEscrow({
        initiator_role: 'buyer',
        initiator_id: buyer.id,
        receiver_id: vendor.id,

        title: 'Marketplace Order',
        description: 'Purchase of items via marketplace',
        acceptance_criteria: 'Items delivered as listed',

        currency: 'NGN',
        amount: subtotal,

        inspection_period: '3 days',
        delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],

        who_pay_fees: 'buyer',

        buyer_details: {
          name: `${buyer.first_name} ${buyer.last_name}`,
          email: buyer.email,
          phone: buyer.phone_number ?? 'N/A',
        },

        seller_details: {
          name: `${vendor.first_name} ${vendor.last_name}`,
          email: vendor.email,
          phone: vendor.phone_number ?? 'N/A',
        },
      });

      /* CREATE ORDER */
      const order = this.orderRepo.create({
        id: uuidv4(),
        buyer_id: buyer.id,
        vendor_id: vendor.id,
        escrow_id: String(escrowResponse.data.escrow_id),
        subtotal,
        shipping_fee: 0,
        tax: null,
        total: subtotal,
        payment_method: 'panda',
        payment_reference: escrowResponse.data.uuid,
        payment_status: 'pending',
        status: 'pending',
        order_items: items,
        notes: null,
      });

      const savedOrder = await this.orderRepo.save(order);
      orders.push(savedOrder);

      /* TRANSACTION: ESCROW HOLD */
      await this.transactions.create({
        order_id: savedOrder.id,
        escrow_id: savedOrder.escrow_id ?? undefined,
        user_id: buyer.id,
        vendor_id: vendor.id,
        type: 'escrow_hold',
        amount: subtotal,
        currency: 'NGN',
        reference: escrowResponse.data.uuid,
        status: 'pending',
        description: 'Funds held in Panda escrow',
        metadata: {
          provider: 'pandascrow',
        },
      });
    }

    await this.cache.clearPrefix('svc:order');

    return {
      success: true,
      orders,
    };
  }

  /* ────────────────────────────────────────────────
   COMPLETE ORDER (PANDASCROW API)
──────────────────────────────────────────────── */
  async completePandaEscrowOrder(data: { order_id: string; otp: string }) {
    const { order_id, otp } = data;

    const order = await this.orderRepo.findOne({
      where: { id: order_id },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.escrow_id || order.payment_method !== 'online') {
      throw new BadRequestException('Order is not a Panda escrow order');
    }

    /* COMPLETE ESCROW ON PANDASCROW */
    await this.pandascrowEscrow.completeEscrow({
      escrow_id: Number(order.escrow_id),
      uuid: order.buyer_id,
      otp,
    });

    /* UPDATE ORDER */
    await this.orderRepo.update(order.id, {
      status: 'completed',
      payment_status: 'success',
    });

    /* TRANSACTION: PAYOUT */
    await this.transactions.create({
      order_id: order.id,
      escrow_id: order.escrow_id ?? undefined,
      user_id: order.buyer_id,
      vendor_id: order.vendor_id,
      type: 'payout',
      amount: order.total,
      currency: 'NGN',
      status: 'success',
      description: 'Panda escrow completed and funds released',
      metadata: {
        provider: 'pandascrow',
      },
    });

    await this.cache.clearPrefix('svc:order');

    return { success: true };
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
   CREATE ONLINE ORDER (PAYSTACK + ESCROW — SINGLE PAYMENT)
──────────────────────────────────────────────── */
  async createOnlineOrder(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
  }) {
    const { buyer_id, email, order_items } = data;

    const buyer = await this.userRepo.findOne({ where: { id: buyer_id } });
    if (!buyer) {
      throw new NotFoundException('Buyer not found');
    }

    const { validatedItems } = await this.buildOrderItems(order_items);

    /* GROUP ITEMS BY VENDOR */
    const groups: Record<string, ICartItem[]> = {};
    for (const item of validatedItems) {
      const { product } = await this.productService.getSingle(item.product_id);
      groups[product.vendor_id] ??= [];
      groups[product.vendor_id].push(item);
    }

    /* VALIDATE VENDORS + CALCULATE GRAND TOTAL */
    let grandTotal = 0;

    for (const vendor_id of Object.keys(groups)) {
      await this.storeService.validateVendorForOnline(vendor_id);

      for (const item of groups[vendor_id]) {
        grandTotal += (item.discount_price ?? item.price) * item.quantity;
      }
    }

    /* INIT SINGLE PAYSTACK PAYMENT */
    const payment = await this.paystack.initializePayment(email, grandTotal);
    const reference = payment.reference;

    const orders: Order[] = [];

    /* CREATE ORDERS + ESCROWS */
    for (const vendor_id of Object.keys(groups)) {
      const items = groups[vendor_id];

      let subtotal = 0;
      for (const item of items) {
        subtotal += (item.discount_price ?? item.price) * item.quantity;
      }

      const order = this.orderRepo.create({
        id: uuidv4(),
        buyer_id,
        vendor_id,
        order_items: items,
        subtotal,
        total: subtotal,
        payment_method: 'online',
        payment_reference: reference, // 🔥 SAME FOR ALL
        payment_url: payment.authorization_url,
        payment_access_code: payment.access_code,
        payment_status: 'pending',
        status: 'pending',
      });

      const savedOrder = await this.orderRepo.save(order);
      orders.push(savedOrder);

      /* CREATE ESCROW PER ORDER */
      const escrow = await this.escrowService.createEscrow({
        order_id: savedOrder.id,
        buyer_id,
        vendor_id,
        amount: subtotal,
      });

      await this.orderRepo.update(savedOrder.id, {
        escrow_id: escrow.id,
      });
    }

    await this.cache.clearPrefix('svc:order');

    return {
      success: true,
      payment_url: payment.authorization_url,
      reference,
      orders,
    };
  }

  /* ────────────────────────────────────────────────
   CREATE ONLINE ORDER (PAYSTACK — SINGLE PAYMENT)
──────────────────────────────────────────────── */
  async createOnlineOrderNoEscrow(data: {
    buyer_id: string;
    email: string;
    order_items: ICartItem[];
  }) {
    const { buyer_id, email, order_items } = data;

    const buyer = await this.userRepo.findOne({ where: { id: buyer_id } });
    if (!buyer) throw new NotFoundException('Buyer not found');

    const { validatedItems } = await this.buildOrderItems(order_items);

    /* GROUP BY VENDOR */
    const groups: Record<string, ICartItem[]> = {};
    for (const item of validatedItems) {
      const { product } = await this.productService.getSingle(item.product_id);
      groups[product.vendor_id] ??= [];
      groups[product.vendor_id].push(item);
    }

    /* CALCULATE GRAND TOTAL */
    let grandTotal = 0;
    for (const vendorItems of Object.values(groups)) {
      for (const item of vendorItems) {
        grandTotal += (item.discount_price ?? item.price) * item.quantity;
      }
    }

    /* INIT SINGLE PAYSTACK PAYMENT */
    const payment = await this.paystack.initializePayment(email, grandTotal);
    const reference = payment.reference;

    const orders: Order[] = [];

    for (const vendor_id of Object.keys(groups)) {
      const items = groups[vendor_id];

      let subtotal = 0;
      for (const item of items) {
        subtotal += (item.discount_price ?? item.price) * item.quantity;
      }

      const order = this.orderRepo.create({
        id: uuidv4(),
        buyer_id,
        vendor_id,
        subtotal,
        total: subtotal,
        payment_method: 'online',
        payment_reference: reference, // 🔥 SAME REF
        payment_url: payment.authorization_url,
        payment_access_code: payment.access_code,
        payment_status: 'pending',
        status: 'pending',
        order_items: items,
        escrow_id: null,
      });

      const saved = await this.orderRepo.save(order);
      orders.push(saved);
    }

    await this.cache.clearPrefix('svc:order');

    return {
      success: true,
      payment_url: payment.authorization_url,
      reference,
      orders,
    };
  }

  /* ────────────────────────────────────────────────
   VERIFY PAYMENT (MULTI-ORDER, SINGLE REFERENCE)
──────────────────────────────────────────────── */
  async verifyPayment(reference: string) {
    /* FETCH ALL ORDERS FOR THIS PAYMENT */
    const orders = await this.orderRepo.find({
      where: { payment_reference: reference },
    });

    if (!orders.length) {
      throw new NotFoundException('Orders not found for this payment');
    }

    /* IDEMPOTENCY CHECK */
    if (orders.every((o) => o.payment_status === 'success')) {
      return {
        success: true,
        idempotent: true,
        orders,
      };
    }

    /* VERIFY PAYSTACK ONCE */
    const verification = await this.paystack.verifyPayment(reference);

    if (verification.status !== 'success') {
      throw new BadRequestException('Payment verification failed');
    }

    const amountPaid = verification.amount / 100;

    const expectedTotal = orders.reduce((sum, o) => sum + Number(o.total), 0);

    if (Number(amountPaid) !== Number(expectedTotal)) {
      throw new BadRequestException('Payment amount mismatch');
    }

    /* PROCESS EACH ORDER */
    for (const order of orders) {
      if (order.payment_status === 'success') continue;

      await this.orderRepo.update(order.id, {
        payment_status: 'success',
        status: 'paid',
      });

      /* FUND ESCROW (IF ANY) */
      if (order.escrow_id) {
        await this.escrowService.fundEscrow(order.escrow_id);
      }

      /* CREATE DELIVERY */
      await this.deliveryService.createDelivery({
        order_id: order.id,
        buyer_id: order.buyer_id,
        vendor_id: order.vendor_id,
      });

      /* TRANSACTION RECORD */
      await this.transactions.create({
        order_id: order.id,
        escrow_id: order.escrow_id ?? undefined,
        user_id: order.buyer_id,
        vendor_id: order.vendor_id,
        type: 'payment_confirmed',
        amount: order.total,
        currency: 'NGN',
        status: 'success',
        description: 'Payment verified manually',
        metadata: {
          provider: 'paystack',
          reference,
        },
      });
    }

    await this.cache.clearPrefix('svc:order');

    return {
      success: true,
      message: 'Payment verified',
      orders,
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
