import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from '../entities/order.entity';
import { PaystackService } from 'src/common/services/paystack.service';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { TransactionsService } from 'src/modules/finance-module/transactions/transactions.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';

@Injectable()
export class OrderPaymentVerificationService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly paystack: PaystackService,
    private readonly escrowService: EscrowService,
    private readonly transactions: TransactionsService,
    private readonly deliveryService: DeliveryService,
    private readonly cache: CacheService,
  ) {}

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

    // Paystack returns amount in kobo (smallest denomination)
    const amountPaidKobo = verification.amount;

    // Calculate expected total in kobo for exact comparison
    let expectedTotalKobo = 0;

    for (const order of orders) {
      // Try to get kobo value from notes first (for new orders)
      try {
        const metadata = JSON.parse(order.notes || '{}');
        if (metadata.total_kobo) {
          expectedTotalKobo += metadata.total_kobo;
        } else {
          // Fallback: convert naira to kobo (for old orders)
          expectedTotalKobo += Math.round(Number(order.total) * 100);
        }
      } catch {
        // If notes parsing fails, convert naira to kobo
        expectedTotalKobo += Math.round(Number(order.total) * 100);
      }
    }

    // Exact comparison in kobo (no floating point issues)
    if (amountPaidKobo !== expectedTotalKobo) {
      throw new BadRequestException(
        `Payment amount mismatch. Expected: ₦${(expectedTotalKobo / 100).toFixed(2)} (${expectedTotalKobo} kobo), Paid: ₦${(amountPaidKobo / 100).toFixed(2)} (${amountPaidKobo} kobo), Difference: ${Math.abs(amountPaidKobo - expectedTotalKobo)} kobo`,
      );
    }

    /* PROCESS EACH ORDER IN A TRANSACTION */
    // Using transaction ensures that if any order update fails, they ALL fail.
    // This prevents partial payment states where some orders are paid and others are pending.
    return await this.dataSource.transaction(async (manager) => {
      for (const order of orders) {
        if (order.payment_status === 'success') continue;

        // 1. Update Order Status (Transactional)
        await manager.update(Order, order.id, {
          payment_status: 'success',
          status: 'paid',
        });

        // 2. Fund Escrow (Side Effect)
        /* FUND ESCROW (IF ANY) */
        if (order.escrow_id) {
          await this.escrowService.fundEscrow(order.escrow_id);
        }

        // 3. Create Delivery (Side Effect)
        /* CREATE DELIVERY */
        await this.deliveryService.createDelivery({
          order_id: order.id,
          buyer_id: order.buyer_id,
          vendor_id: order.vendor_id,
        });

        // 4. Record Transaction (Side Effect)
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

      // Return updated state
      const updatedOrders = orders.map((o) => ({
        ...o,
        payment_status: 'success' as PaymentStatus,
        status: 'paid' as OrderStatus,
      }));

      return {
        success: true,
        message: 'Payment verified',
        orders: updatedOrders,
      };
    });
  }
}
