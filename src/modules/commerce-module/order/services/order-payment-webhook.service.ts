import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PaystackService } from 'src/common/services/paystack.service';
import { OrderService } from './order.service';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { TransactionsService } from 'src/modules/finance-module/transactions/transactions.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { OrderMailService } from 'src/modules/shared-module/email/services/order-mail.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { ProductService } from '../../product/services/product.service';
import { DataSource } from 'typeorm';
import { Order } from '../entities/order.entity';

@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly orders: OrderService,
    private readonly transactions: TransactionsService,
    private readonly delivery: DeliveryService,
    private readonly escrow: EscrowService,
    private readonly paystack: PaystackService,
    private readonly productService: ProductService,
    private readonly mail: OrderMailService,
    private readonly cache: CacheService,
    private readonly dataSource: DataSource,
  ) {}

  /* ────────────────────────────────────────────────
     HANDLE PAYSTACK WEBHOOK
  ──────────────────────────────────────────────── */
  async handlePaystackWebhook(payload: any) {
    const reference = payload?.data?.reference || payload?.reference;
    if (!reference) {
      console.warn('Paystack Webhook received without reference:', payload);
      return;
    }

    const orders = await this.orders.getOrdersByPaymentReference(reference);
    if (!orders.length) {
      throw new NotFoundException(
        `No orders found for payment reference: ${reference}`,
      );
    }

    // Idempotent check
    if (orders.every((o) => o.payment_status === 'success')) return;

    const verification = await this.paystack.verifyPayment(reference);
    if (verification.status !== 'success') {
      throw new BadRequestException('Webhook payment verification failed');
    }

    const amountPaidKobo = verification.amount;
    const expectedTotalKobo = orders.reduce(
      (sum, o) => sum + Number(o.total),
      0,
    );

    if (amountPaidKobo !== expectedTotalKobo) {
      throw new BadRequestException(
        `Webhook amount mismatch. Expected: ${expectedTotalKobo} kobo, Paid: ${amountPaidKobo} kobo`,
      );
    }

    /* MARK ALL ORDERS AS PAID IN A TRANSACTION */
    await this.dataSource.transaction(async (manager) => {
      for (const order of orders) {
        if (order.payment_status === 'success') continue;

        // 1. Update Order Status
        await manager.update(Order, order.id, {
          payment_status: 'success',
          status: 'paid',
        });

        // 2. Fund Escrow (Side Effect)
        if (order.escrow_id) {
          await this.escrow.fundEscrow(order.escrow_id);
        }

        // 3. Create Delivery
        await this.delivery.createDelivery({
          order_id: order.id,
          buyer_id: order.buyer_id!,
          vendor_id: order.vendor_id,
        });

        // 4. Record Transaction
        await this.transactions.create({
          order_id: order.id,
          escrow_id: order.escrow_id ?? undefined,
          user_id: order.buyer_id!,
          vendor_id: order.vendor_id,
          type: 'payment_webhook',
          amount: order.total,
          currency: 'NGN',
          status: 'success',
          description: 'Payment confirmed via webhook',
          metadata: payload,
        });

        // 5. Adjust Stock (REDUCE) — variant-aware
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
      }
    });

    /* ────────────────────────────────────────────────
     EMAILS (NON-BLOCKING)
  ──────────────────────────────────────────────── */

    // 1️⃣ Buyer email (send once)
    const firstOrder = orders[0];

    try {
      await this.mail.sendPaymentVerified({
        email: firstOrder.buyer.email,
        name: firstOrder.buyer.first_name,
        order: {
          id: firstOrder.id,
          status: 'paid',
          total: expectedTotalKobo / 100,
          items: firstOrder.order_items,
          subtotal: Number(firstOrder.subtotal),
          shipping_fee: Number(firstOrder.shipping_fee),
        },
      });
    } catch (error) {
      console.error('Failed to send payment verified email to buyer:', error);
    }

    // 2️⃣ Vendor emails (per order)
    for (const order of orders) {
      try {
        await this.mail.sendVendorPaymentVerified({
          email: order.vendor.email,
          name: order.vendor.first_name,
          order: {
            id: order.id,
            status: 'paid',
            total: Number(order.total) / 100,
            items: order.order_items,
            subtotal: Number(order.subtotal),
            shipping_fee: Number(order.shipping_fee),
          },
        });
      } catch (error) {
        console.error(
          'Failed to send payment verified email to vendor:',
          error,
        );
      }
    }

    await this.cache.clearPrefix('svc:order');
  }
}
