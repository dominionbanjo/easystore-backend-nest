import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { StoreAnalyticsService } from 'src/modules/vendor-module/store-analytics/services/store-analytics.service';
import { ProductService } from '../../product/services/product.service';
import { DataSource } from 'typeorm';

@Injectable()
export class OrderManagementService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly escrowService: EscrowService,
    private readonly cache: CacheService,
    private readonly productService: ProductService,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => StoreAnalyticsService))
    private readonly analyticsService: StoreAnalyticsService,
  ) {}

  /* ────────────────────────────────────────────────
     PRIVATE: PROCESS ANALYTICS
  ──────────────────────────────────────────────── */
  private async processAnalytics(orderId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['vendor', 'vendor.store'],
    });

    if (!order || order.analytics_processed) return;

    if (!order.vendor?.store?.id) {
      console.warn(
        `Store not found for vendor ${order.vendor_id} on order ${order.id}`,
      );
      return;
    }

    try {
      await this.analyticsService.updateFromOrder(
        order.vendor.store.id,
        order.total,
        order.buyer_id,
        order.order_items,
      );

      await this.orderRepo.update(orderId, { analytics_processed: true });
    } catch (error) {
      console.error(`Failed to update analytics for order ${orderId}:`, error);
    }
  }

  /* ────────────────────────────────────────────────
     MARK ORDER AS PAID
  ──────────────────────────────────────────────── */
  async markPaid(orderId: string) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new BadRequestException('Order not found');
    if (order.status === 'paid' || order.payment_status === 'success') return;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, orderId, {
        payment_status: 'success',
        status: 'paid',
      });

      // Reduce stock
      for (const item of order.order_items) {
        await this.productService.adjustStock(
          item.product_id,
          -Number(item.quantity),
          manager,
        );
      }
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
  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new BadRequestException('Order not found');

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
          await this.productService.adjustStock(
            item.product_id,
            Number(item.quantity),
            manager,
          );
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

    await this.cache.clearPrefix('svc:order');
    return { success: true };
  }

  /* ────────────────────────────────────────────────
     CANCEL ORDER
  ──────────────────────────────────────────────── */
  async cancelOrder(id: string, requestedBy: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new BadRequestException('Order not found');

    if (requestedBy !== order.buyer_id && requestedBy !== order.vendor_id) {
      throw new BadRequestException('Unauthorized');
    }

    const previousStatus = order.status;
    const isPaidState = ['paid', 'processing', 'in_transit'].includes(
      previousStatus,
    );

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, id, { status: 'canceled' });

      if (isPaidState) {
        for (const item of order.order_items) {
          await this.productService.adjustStock(
            item.product_id,
            Number(item.quantity),
            manager,
          );
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
