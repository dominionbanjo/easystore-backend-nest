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

    const orders = await this.orders.getOrdersByPaymentReference(reference);
    if (!orders.length) return;

    // Idempotent check
    if (orders.every((o) => o.payment_status === 'success')) return;

    const verification = await this.paystack.verifyPayment(reference);
    if (verification.status !== 'success') {
      throw new BadRequestException('Webhook payment verification failed');
    }

    const amountPaid = verification.amount / 100;

    const expectedTotal = orders.reduce((sum, o) => sum + Number(o.total), 0);

    if (Number(amountPaid) !== Number(expectedTotal)) {
      throw new BadRequestException('Webhook amount mismatch');
    }

    /* MARK ALL ORDERS AS PAID */
    for (const order of orders) {
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
        escrow_id: order.escrow_id ?? undefined,
        user_id: order.buyer_id,
        vendor_id: order.vendor_id,
        type: 'payment_webhook',
        amount: order.total,
        currency: 'NGN',
        status: 'success',
        description: 'Payment confirmed (shared checkout)',
        metadata: payload,
      });
    }

    /* ────────────────────────────────────────────────
     EMAILS
  ──────────────────────────────────────────────── */

    // 1️⃣ Buyer email (send once)
    const firstOrder = orders[0];

    await this.mail.sendPaymentVerified({
      email: firstOrder.buyer.email,
      name: firstOrder.buyer.first_name,
      order: {
        id: firstOrder.id,
        status: 'paid',
        total: expectedTotal,
      },
    });

    // 2️⃣ Vendor emails (per order)
    for (const order of orders) {
      await this.mail.sendVendorPaymentVerified({
        email: order.vendor.email,
        name: order.vendor.first_name,
        order: {
          id: order.id,
          status: 'paid',
          total: order.total,
        },
      });
    }

    await this.cache.clearPrefix('svc:order');
  }
}
