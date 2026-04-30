import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus, PaymentStatus } from '../entities/order.entity';
import { PaystackService } from 'src/common/services/paystack.service';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { TransactionsService } from 'src/modules/finance-module/transactions/transactions.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { ProductService } from '../../product/services/product.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';

import { OrderMailService } from 'src/modules/shared-module/email/services/order-mail.service';
import { ReceiptService } from './receipt.service';
import { OrderManagementService } from './order-management.service';

@Injectable()
export class OrderPaymentVerificationService {
  private readonly logger = new Logger(OrderPaymentVerificationService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly paystack: PaystackService,
    private readonly escrowService: EscrowService,
    private readonly transactions: TransactionsService,
    private readonly deliveryService: DeliveryService,
    private readonly productService: ProductService,
    private readonly cache: CacheService,
    private readonly orderMailService: OrderMailService,
    private readonly receiptService: ReceiptService,
    private readonly orderManagementService: OrderManagementService,
  ) {}

  /* ────────────────────────────────────────────────
   VERIFY PAYMENT (MULTI-ORDER, SINGLE REFERENCE)
──────────────────────────────────────────────── */
  async verifyPayment(reference: string) {
    const lockKey = `lock:verify-payment:${reference}`;
    const acquired = await this.cache.acquireLock(lockKey, 30); // 30 sec lock
    if (!acquired) {
      throw new ConflictException(
        'Payment verification is already in progress. Please wait a moment.',
      );
    }

    try {
      /* FETCH ALL ORDERS FOR THIS PAYMENT */
      const orders = await this.orderRepo.find({
        where: { payment_reference: reference },
        relations: ['buyer'],
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
      // For new orders, total is already in kobo
      expectedTotalKobo += Number(order.total);
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
          buyer_id: order.buyer_id!,
          vendor_id: order.vendor_id,
        });

        // 4. Record Transaction (Side Effect)
          /* TRANSACTION RECORD */
          await this.transactions.create({
            order_id: order.id,
            escrow_id: order.escrow_id ?? undefined,
            user_id: order.buyer_id!,
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
  
          // 5. Track verified product customer
          await this.orderManagementService.createProductCustomers(order, manager);
  
          // 6. Adjust Stock (REDUCE) — variant-aware
        for (const item of order.order_items) {
          if (item.variant_id) {
            // Deduct from the specific variant AND keep product aggregate in sync
            await this.productService.adjustVariantStock(
              item.variant_id,
              -Number(item.quantity),
              manager,
            );
          } else {
            // Legacy: no variant — deduct from product stock directly
            await this.productService.adjustStock(
              item.product_id,
              -Number(item.quantity),
              manager,
            );
          }
        }

        // 6. Send Confirmation Email & Receipt
        try {
          const receiptBuffer = await this.receiptService.generateReceiptPdf(order);
          await this.orderMailService.sendPaymentVerified(
            {
              email: order.buyer.email,
              name: order.buyer.first_name,
              order: {
                id: order.id,
                status: 'paid',
                total: Number(order.total) / 100,
                items: order.order_items,
                subtotal: order.subtotal,
                shipping_fee: order.shipping_fee,
              },
            },
            receiptBuffer,
          );
        } catch (mailError) {
          this.logger.error(
            `Failed to send receipt for order ${order.id}: ${mailError.message}`,
          );
        }
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
    } finally {
      await this.cache.releaseLock(lockKey);
    }
  }

  /**
   * Retry order payment: verify existing reference first, then re-initialize if needed.
   */
  async retryOrderPayment(orderId: string, userId: string) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      relations: ['buyer'],
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.buyer_id !== userId) throw new BadRequestException('Unauthorized');

    if (order.payment_status === 'success') {
      return { success: true, auto_verified: true, orders: [order] };
    }

    // 1. Try auto-verification if a reference exists
    if (order.payment_reference) {
      try {
        const verification = await this.paystack.verifyPayment(order.payment_reference);
        if (verification.status === 'success') {
          // Idempotent verification call
          const result = await this.verifyPayment(order.payment_reference);
          return { ...result, auto_verified: true };
        }
      } catch (error) {
        this.logger.warn(`Auto-verification failed during retry for ${order.id}: ${error.message}`);
      }
    }

    // 2. Re-initialize payment if verification failed or no reference exists
    const amountKobo = Number(order.total);
    const email = order.buyer.email;

    let metadata: any = {};
    try {
      metadata = JSON.parse(order.notes || '{}');
    } catch (e) {
      metadata = {};
    }

    const payment = await this.paystack.initializePayment(email, amountKobo, {
      metadata: {
        ...metadata,
        order_id: order.id,
        retry: true,
      },
    });

    await this.orderRepo.update(order.id, {
      payment_reference: payment.reference,
      payment_url: payment.authorization_url,
      payment_access_code: payment.access_code,
    });

    return {
      success: true,
      auto_verified: false,
      payment_url: payment.authorization_url,
      reference: payment.reference,
    };
  }
}
