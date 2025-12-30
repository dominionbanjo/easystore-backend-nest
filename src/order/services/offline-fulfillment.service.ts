import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { DeliveryService } from 'src/delivery/delivery.service';
import { TransactionsService } from 'src/transactions/transactions.service';
import { StoreService } from 'src/store/store.service';
import { CacheService } from 'src/cache/cache.service';
import { OrderService } from './order.service';

@Injectable()
export class OfflineFulfillmentService {
  constructor(
    private readonly orders: OrderService,
    private readonly delivery: DeliveryService,
    private readonly transactions: TransactionsService,
    private readonly stores: StoreService,
    private readonly cache: CacheService,
  ) {}

  /* ────────────────────────────────────────────────
     FULFILL OFFLINE ORDER (VENDOR)
  ──────────────────────────────────────────────── */
  async fulfill(orderId: string, vendorId: string) {
    const order = await this.orders.getOrder(orderId);
    if (!order) throw new NotFoundException('Order not found');

    if (order.vendor_id !== vendorId) {
      throw new BadRequestException('You can only fulfill your own orders');
    }

    if (order.payment_method !== 'offline') {
      throw new BadRequestException('Not an offline order');
    }

    await this.delivery.confirmOfflineDelivery(orderId);

    await this.orders.markCompleted(orderId);

    await this.transactions.create({
      order_id: order.id,
      user_id: order.buyer_id,
      vendor_id: vendorId,
      type: 'offline_fulfillment',
      amount: order.total,
      currency: 'NGN',
      status: 'success',
      description: 'Order fulfilled offline',
    });

    await this.cache.clearPrefix('svc:order');

    return {
      success: true,
      message: 'Offline order fulfilled successfully',
    };
  }
}
