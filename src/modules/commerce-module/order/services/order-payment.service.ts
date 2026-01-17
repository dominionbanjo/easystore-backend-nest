import { Injectable, BadRequestException } from '@nestjs/common';
import { PaystackService } from 'src/common/services/paystack.service';
import { OrderService } from './order.service';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { TransactionsService } from 'src/modules/finance-module/transactions/transactions.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { OrderMailService } from 'src/modules/shared-module/email/services/order-mail.service';
import { DeliveryService } from '../../delivery/delivery.service';

@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly orders: OrderService,
    private readonly transactions: TransactionsService,
    private readonly delivery: DeliveryService,
    private readonly escrow: EscrowService,
    private readonly paystack: PaystackService,
    private readonly mail: OrderMailService,
    private readonly cache: CacheService,
  ) {}

  /* ────────────────────────────────────────────────
     HANDLE PAYSTACK WEBHOOK
  ──────────────────────────────────────────────── */
  async handlePaystackWebhook(payload: any) {
    const reference = payload?.reference;
    if (!reference) return;

    const order = await this.orders.getByPaymentReference(reference);
    if (!order) return;

    // Idempotent
    if (order.payment_status === 'success') return;

    const verification = await this.paystack.verifyPayment(reference);
    if (verification.status !== 'success') {
      throw new BadRequestException('Webhook payment verification failed');
    }

    const amountPaid = verification.amount / 100;
    if (Number(amountPaid) !== Number(order.total)) {
      throw new BadRequestException('Webhook amount mismatch');
    }

    await this.orders.markPaid(order.id);

    if (order.escrow_id) {
      await this.escrow.fundEscrow(order.escrow_id);
    }

    await this.delivery.createDelivery({
      order_id: order.id,
      buyer_id: order.buyer_id,
      vendor_id: order.vendor_id,
    });

    await this.transactions.create({
      order_id: order.id,
      escrow_id: order.escrow_id || undefined,
      user_id: order.buyer_id,
      vendor_id: order.vendor_id,
      type: 'payment_webhook',
      amount: order.total,
      currency: 'NGN',
      status: 'success',
      description: 'Payment confirmed by webhook',
      metadata: payload,
    });

    await this.mail.sendPaymentVerified({
      email: order.buyer.email,
      name: order.buyer.first_name,
      order,
    });

    await this.cache.clearPrefix('svc:order');
  }
}
