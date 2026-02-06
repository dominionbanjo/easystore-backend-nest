import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus } from '../entities/order.entity';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';

@Injectable()
export class OrderManagementService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly escrowService: EscrowService,
    private readonly cache: CacheService,
  ) {}

  /* ────────────────────────────────────────────────
     MARK ORDER AS PAID
  ──────────────────────────────────────────────── */
  async markPaid(orderId: string) {
    await this.orderRepo.update(orderId, {
      payment_status: 'success',
      status: 'paid',
    });
  }

  /* ────────────────────────────────────────────────
     MARK ORDER AS COMPLETED
  ──────────────────────────────────────────────── */
  async markCompleted(orderId: string) {
    await this.orderRepo.update(orderId, {
      status: 'completed',
    });
  }

  /* ────────────────────────────────────────────────
     UPDATE ORDER STATUS
  ──────────────────────────────────────────────── */
  async updateOrderStatus(id: string, status: OrderStatus) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new BadRequestException('Order not found');

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
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new BadRequestException('Order not found');

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
