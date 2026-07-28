import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { StoreAnalyticsService } from 'src/modules/vendor-module/store-analytics/services/store-analytics.service';
import { ProductService } from '../../product/services/product.service';
import { ProductCustomer } from '../../product/entities/product-customer.entity';
import { OrderMailService } from 'src/modules/shared-module/email/services/order-mail.service';
import { DataSource } from 'typeorm';

@Injectable()
export class OrderManagementService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly escrowService: EscrowService,
    private readonly cache: CacheService,
    private readonly productService: ProductService,
    private readonly orderMailService: OrderMailService,
    private readonly dataSource: DataSource,
    @InjectRepository(ProductCustomer)
    private readonly productCustomerRepo: Repository<ProductCustomer>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly analyticsService: StoreAnalyticsService,
  ) {}

  /* ────────────────────────────────────────────────
     PRIVATE: PROCESS ANALYTICS
  ──────────────────────────────────────────────── */
  private async processAnalytics(orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['vendor', 'store', 'vendor.stores'],
    });

    if (!order || order.analytics_processed) return;

    const storeId = order.store_id ?? order.vendor?.stores?.[0]?.id;
    if (!storeId) {
      console.warn(
        `Store not found for vendor ${order.vendor_id} on order ${order.id}`,
      );
      return;
    }

    try {
      await this.analyticsService.updateFromOrder(
        storeId,
        order.total,
        order.buyer_id,
        order.order_items,
        order.payment_method === 'offline' // Track if this is offline revenue
      );

      await this.orderRepo.update(orderId, { analytics_processed: true });
    } catch (error) {
      console.error(`Failed to update analytics for order ${orderId}:`, error);
    }
  }

  /* ────────────────────────────────────────────────
     PUBLIC: CREATE VERIFIED PRODUCT CUSTOMERS
  ──────────────────────────────────────────────── */
  public async createProductCustomers(order: Order, manager: any) {
    if (!order.order_items || order.order_items.length === 0) return;

    for (const item of order.order_items) {
      // Check if already exists to prevent duplicates (e.g. if called multiple times)
      const existing = await manager.findOne(ProductCustomer, {
        where: { order_id: order.id, product_id: item.product_id },
      });

      if (!existing) {
        await manager.insert(ProductCustomer, {
          product_id: item.product_id,
          vendor_id: item.vendor_id || order.vendor_id,
          user_id: order.buyer_id, // Could be null for pure offline
          order_id: order.id,
          customer_name: order.buyer?.first_name 
            ? `${order.buyer.first_name} ${order.buyer.last_name}`.trim() 
            : null,
          customer_email: order.buyer?.email || null,
        });
      }
    }
  }

  /* ────────────────────────────────────────────────
     MARK ORDER AS PAID
  ──────────────────────────────────────────────── */
  async markPaid(orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['buyer'],
    });
    if (!order) throw new BadRequestException('Order not found');
    if (order.status === 'paid' || order.payment_status === 'success') return;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, orderId, {
        payment_status: 'success',
        status: 'paid',
      });

      // Reduce stock
      for (const item of order.order_items) {
        if (item.variant_id) {
          await this.productService.adjustVariantStock(
            item.variant_id,
            -Number(item.quantity),
            manager,
          );
        } else {
          await this.productService.adjustStock(
            item.product_id,
            -Number(item.quantity),
            manager,
          );
        }
      }

      // Track verified product customer
      await this.createProductCustomers(order, manager);
    });

    await this.cache.clearPrefix('svc:order');
  }

  /* ────────────────────────────────────────────────
     MARK ORDER AS COMPLETED
  ──────────────────────────────────────────────── */
  async markCompleted(orderId: string) {
    await this.orderRepo.update(orderId, {
      status: 'completed',
    });
    // Trigger analytics
    await this.processAnalytics(orderId);
  }

  /* ────────────────────────────────────────────────
     UPDATE ORDER STATUS
  ──────────────────────────────────────────────── */
  async updateOrderStatus(id: string, status: OrderStatus, storeId?: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      select: { id: true, vendor_id: true, status: true, order_items: true, payment_method: true, buyer_id: true },
    });
    if (!order) throw new BadRequestException('Order not found');
    const store = await this.storeRepo.findOne({
      where: { user_id: order.vendor_id },
      select: { id: true },
    });
    if (store?.id !== storeId) throw new ForbiddenException('You do not own this order');

    const previousStatus = order.status;

    // If transitioning to a status that indicates payment (if not already paid)
    // Actually, usually it goes through markPaid or webhook.
    // But if they manually set it to 'paid' here:
    if (status === 'paid' && previousStatus !== 'paid') {
      await this.markPaid(id);
      return { success: true };
    }

    // If transitioning from a "paid" state to a "failed" or "canceled" state, restore stock
    const isPaidState = [
      'paid',
      'processing',
      'in_transit',
      'delivered',
      'completed',
    ].includes(previousStatus);
    const isNegativeState = ['failed', 'canceled'].includes(status);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, id, { status });

      if (isPaidState && isNegativeState) {
        for (const item of order.order_items) {
          if (item.variant_id) {
            await this.productService.adjustVariantStock(
              item.variant_id,
              Number(item.quantity),
              manager,
            );
          } else {
            await this.productService.adjustStock(
              item.product_id,
              Number(item.quantity),
              manager,
            );
          }
        }
      }
    });

    if (status === 'delivered' && order.payment_method === 'online') {
      await this.escrowService.markDelivered(order.id);
    }

    // Trigger analytics if delivered or completed
    if (status === 'delivered' || status === 'completed') {
      await this.processAnalytics(id);
    }

    // Send Rate Vendor Email when delivered (if online/buyer exists)
    if (status === 'delivered' && order.buyer_id) {
      const fullOrder = await this.orderRepo.findOne({
        where: { id: order.id },
        relations: ['buyer', 'vendor', 'vendor.stores'],
      });
      if (fullOrder && fullOrder.buyer?.email && fullOrder.vendor?.stores?.[0]) {
        await this.orderMailService.sendRateVendorEmail({
          email: fullOrder.buyer.email,
          name: fullOrder.buyer.first_name,
          storeName: fullOrder.vendor.stores[0].store_name,
          orderId: fullOrder.id,
          products: fullOrder.order_items,
        });
      }
    }

    await this.cache.clearPrefix('svc:order');
    return { success: true };
  }

  /* ────────────────────────────────────────────────
     CANCEL ORDER
  ──────────────────────────────────────────────── */
  async cancelOrder(id: string, requestedBy: string, storeId?: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      select: { id: true, buyer_id: true, vendor_id: true, status: true, order_items: true, payment_method: true },
    });
    if (!order) throw new BadRequestException('Order not found');

    if (requestedBy !== order.buyer_id && requestedBy !== order.vendor_id) {
      const store = await this.storeRepo.findOne({
        where: { user_id: order.vendor_id },
        select: { id: true },
      });
      if (store?.id !== storeId) throw new ForbiddenException('Unauthorized');
    }

    const previousStatus = order.status;
    const isPaidState = ['paid', 'processing', 'in_transit'].includes(
      previousStatus,
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, id, { status: 'canceled' });

      if (isPaidState) {
        for (const item of order.order_items) {
          if (item.variant_id) {
            await this.productService.adjustVariantStock(
              item.variant_id,
              Number(item.quantity),
              manager,
            );
          } else {
            await this.productService.adjustStock(
              item.product_id,
              Number(item.quantity),
              manager,
            );
          }
        }
      }
    });

    if (order.escrow_id && order.payment_method === 'online') {
      await this.escrowService.refundEscrow(order.escrow_id, requestedBy);
    }

    await this.cache.clearPrefix('svc:order');

    return { success: true };
  }
}
