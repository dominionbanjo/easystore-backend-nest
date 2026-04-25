import {
  Injectable,
  forwardRef,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order } from '../entities/order.entity';
import { ICartItem } from '../../cart/types/types';
import { OrderValidationService } from './order-validation.service';
import { TransactionsService } from 'src/modules/finance-module/transactions/transactions.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { CartService } from '../../cart/cart.service';
import { ProductService } from '../../product/services/product.service';
import { StoreAnalyticsService } from 'src/modules/vendor-module/store-analytics/services/store-analytics.service';
import { StoreService } from 'src/modules/vendor-module/store/services/store.service';

@Injectable()
export class OfflineOrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    private readonly validationService: OrderValidationService,
    private readonly transactions: TransactionsService,
    private readonly deliveryService: DeliveryService,
    private readonly cache: CacheService,
    private readonly cartService: CartService,
    private readonly productService: ProductService,
    @Inject(forwardRef(() => StoreAnalyticsService))
    private readonly storeAnalyticsService: StoreAnalyticsService,
    private readonly storeService: StoreService,
  ) {}

  /**
   * Create offline order (buyer checkout)
   */
  async createOfflineOrder(data: {
    buyer_id: string;
    order_items: ICartItem[];
    tax?: number;
    notes?: string;
  }) {
    const { buyer_id, order_items, tax = 0, notes } = data;

    const { validatedItems } = await this.validationService.buildOrderItems(
      order_items,
      buyer_id,
    );

    const groups =
      await this.validationService.groupItemsByVendor(validatedItems);

    const orders: Order[] = [];

    for (const vendor_id of Object.keys(groups)) {
      const vendorItems = groups[vendor_id];

      let subtotalKobo = 0;
      for (const i of vendorItems) {
        subtotalKobo += i.unit_price * i.quantity;
      }

      const taxKobo = tax;
      const totalKobo = subtotalKobo + taxKobo;

      const order = this.orderRepo.create({
        id: uuidv4(),
        buyer_id,
        vendor_id,
        order_items: vendorItems,
        subtotal: subtotalKobo,
        tax: taxKobo,
        total: totalKobo,
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
        amount: totalKobo,
        currency: 'NGN',
        status: 'pending',
        description: 'Offline order created',
      });

      await this.deliveryService.createDelivery({
        order_id: saved.id,
        buyer_id,
        vendor_id,
      });
    }

    await this.cache.clearPrefix('svc:order');
    await this.cartService.clearCart(buyer_id);

    return {
      success: true,
      orders,
    };
  }

  /**
   * Record Vendor Offline Sale (Vendor manual dashboard)
   */
  async recordVendorOfflineSale(data: {
    vendor_id: string;
    items: { product_id: string; variant_id?: string; quantity: number }[];
    customer_name?: string;
    customer_email?: string;
    notes?: string;
  }) {
    const { vendor_id, items, customer_name, customer_email, notes } = data;

    if (!items || items.length === 0) {
      throw new BadRequestException('At least one item is required');
    }

    // Since this is vendor-direct, we bypass normal cart rules and use product definitions
    const orderItems: ICartItem[] = [];
    let subtotalKobo = 0;

    for (const item of items) {
      const productResult = await this.productService.getSingle(
        item.product_id,
      );
      const product = productResult.product;

      if (!product || product.vendor_id !== vendor_id) {
        throw new BadRequestException(
          `Product ${item.product_id} not found or doesn't belong to vendor`,
        );
      }

      let price = Number(product.price);
      let name = product.name;

      if (item.variant_id) {
        const variant = product.variants?.find((v) => v.id === item.variant_id);
        if (!variant) {
          throw new BadRequestException(`Variant ${item.variant_id} not valid`);
        }
        price = Number(variant.price);
        name = `${product.name} (${Object.values(variant.combinations || {}).join(', ')})`;
      }

      const itemTotal = price * item.quantity;
      subtotalKobo += itemTotal;

      orderItems.push({
        product_id: product.id,
        vendor_id,
        name,
        slug: product.slug,
        price,
        discount_price: null,
        unit_price: price,
        image:
          product.image?.url ||
          (typeof product.image === 'string' ? product.image : null),
        variant_id: item.variant_id ?? null,
        variant_options:
          item.variant_id && product.variants
            ? product.variants.find((v) => v.id === item.variant_id)
                ?.combinations || null
            : null,
        quantity: item.quantity,
        size: null,
        color: null,
      });
    }

    const orderEntity = this.orderRepo.create({
      id: uuidv4(),
      buyer_id: null,
      vendor_id,
      order_items: orderItems,
      subtotal: subtotalKobo,
      shipping_fee: 0,
      total: subtotalKobo,
      payment_method: 'offline' as any,
      payment_status: 'success',
      status: 'completed',
      notes:
        notes ||
        `Manual offline sale recorded by vendor. Customer: ${customer_name || 'Walk-in'}`,
    });

    const savedOrder = await this.orderRepo.save(orderEntity);
    const orderId = (savedOrder as Order).id;

    // Record the explicit transaction
    await this.transactions.create({
      order_id: orderId,
      user_id: vendor_id,
      vendor_id,
      type: 'payout',
      amount: subtotalKobo,
      currency: 'NGN',
      status: 'success',
      description: `Manual offline sale: ${customer_name || 'Walk-in'}`,
    });

    // Reduce stock
    await this.orderRepo.manager.transaction(async (manager) => {
      for (const item of orderItems) {
        if (item.variant_id) {
          await this.productService.adjustVariantStock(
            item.variant_id,
            -item.quantity,
            manager,
          );
        } else {
          await this.productService.adjustStock(
            item.product_id,
            -item.quantity,
            manager,
          );
        }
      }
    });

    // Resolve Store ID (analytics is keyed by store_id, not vendor_id)
    const store = await this.storeService.getStoreByUser(vendor_id);
    const storeId = store.id;

    // Update Analytics
    await this.storeAnalyticsService.updateFromOrder(
      storeId,
      subtotalKobo,
      null, // customer_id
      orderItems,
      true, // isOffline
    );

    await this.cache.clearPrefix('svc:order');
    await this.cache.clearPrefix('svc:product');

    return {
      success: true,
      order: savedOrder,
    };
  }
}
