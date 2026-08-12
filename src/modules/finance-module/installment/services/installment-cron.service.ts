import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, IsNull, Not } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { InstallmentMailService } from 'src/modules/shared-module/email/services/installment-mail.service';
import {
  INSTALLMENT_WARNING_1_DAYS,
  INSTALLMENT_WARNING_2_DAYS,
  INSTALLMENT_DEFAULT_DAYS,
  INSTALLMENT_AUTO_CHARGE_RETRIES,
  INSTALLMENT_DEPOSIT_EXPIRY_HOURS,
  INSTALLMENT_REFERENCE_PREFIX,
} from '../installment.constants';
import { InstallmentPlan } from '../entities/installment-plan.entity';
import { InstallmentPayment } from '../entities/installment-payment.entity';
import { InstallmentService } from './installment.service';
import { PaystackService } from 'src/common/services/paystack.service';
import { TransactionsService } from 'src/modules/finance-module/transactions/transactions.service';

interface PaystackChargeShape {
  status: string;
  reference: string;
}

@Injectable()
export class InstallmentCronService {
  private readonly logger = new Logger(InstallmentCronService.name);

  constructor(
    @InjectRepository(InstallmentPlan)
    private readonly planRepo: Repository<InstallmentPlan>,
    @InjectRepository(InstallmentPayment)
    private readonly paymentRepo: Repository<InstallmentPayment>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly installments: InstallmentService,
    private readonly paystack: PaystackService,
    private readonly transactions: TransactionsService,
    private readonly cache: CacheService,
    private readonly mail: InstallmentMailService,
  ) {}

  /** Runs every hour — handles deposit expiry, auto-charges and the warning ladder. */
  @Cron('0 * * * *')
  async handleInstallmentLifecycle() {
    this.logger.log('Starting installment lifecycle task...');
    await this.expireUnpaidDeposits();
    await this.processAutoCharges();
    await this.processWarningsAndDefaults();
    this.logger.log('Installment lifecycle task finished.');
  }

  /* ────────────────────────────────────────────────
     1. DEPOSIT EXPIRY — plan created but deposit unpaid
        → release reservation + cancel plan (no refund needed)
  ──────────────────────────────────────────────── */
  private async expireUnpaidDeposits() {
    const cutoff = new Date(
      Date.now() - INSTALLMENT_DEPOSIT_EXPIRY_HOURS * 3600_000,
    );
    const expired = await this.planRepo.find({
      where: {
        status: 'active',
        deposit_expires_at: LessThan(cutoff),
      },
      relations: ['order'],
    });

    for (const plan of expired) {
      const lockKey = `lock:installment:expire:${plan.id}`;
      const acquired = await this.cache.acquireLock(lockKey, 20);
      if (!acquired) continue;
      try {
        const deposit = await this.paymentRepo.findOne({
          where: { plan_id: plan.id, index: 1 },
        });
        if (deposit?.status === 'paid') continue;

        /* Release reservation */
        for (const item of (plan.order?.order_items ?? []) as Array<{
          product_id: string;
          variant_id?: string | null;
          quantity: number;
        }>) {
          if (item.variant_id) {
            await this.installments.releaseReservationFor(
              item.variant_id,
              Number(item.quantity),
              true,
            );
          } else {
            await this.installments.releaseReservationFor(
              item.product_id,
              Number(item.quantity),
              false,
            );
          }
        }

        await this.orderRepo.update(plan.order_id, {
          status: 'canceled',
          payment_status: 'canceled',
        });
        await this.planRepo.update(plan.id, {
          status: 'canceled',
          canceled_at: new Date(),
        });
        await this.cache.clearPrefix('svc:order');
        await this.cache.clearPrefix('svc:installment');
        this.logger.log(`Expired unpaid deposit for plan ${plan.id}`);
      } finally {
        await this.cache.releaseLock(lockKey);
      }
    }
  }

  /* ────────────────────────────────────────────────
     2. AUTO-CHARGES — saved-card plans with a due payment
  ──────────────────────────────────────────────── */
  private async processAutoCharges() {
    const now = new Date();
    const duePlans = await this.planRepo.find({
      where: {
        status: 'active',
        mode: 'auto',
        next_due_date: LessThan(now),
      },
    });

    for (const plan of duePlans) {
      const lockKey = `lock:installment:auto:${plan.id}`;
      const acquired = await this.cache.acquireLock(lockKey, 20);
      if (!acquired) continue;

      try {
        if (plan.charge_retries >= INSTALLMENT_AUTO_CHARGE_RETRIES) continue;
        if (!plan.authorization_code) continue;

        const payment = await this.paymentRepo.findOne({
          where: { plan_id: plan.id, status: 'pending' },
          order: { index: 'ASC' },
        });
        if (!payment) continue;

        const buyer = await this.userRepo.findOne({
          where: { id: plan.buyer_id },
        });
        if (!buyer?.email) continue;

        const reference = `${INSTALLMENT_REFERENCE_PREFIX}${uuidv4().replace(/-/g, '')}`;
        const charge = (await this.paystack.chargeAuthorization({
          authorization_code: plan.authorization_code,
          email: buyer.email,
          amountKobo: Number(payment.amount_kobo) + Number(payment.fee_kobo),
          reference,
          metadata: {
            plan_id: plan.id,
            installment_index: payment.index,
            order_type: 'installment',
            auto_charge: true,
          },
        })) as unknown as PaystackChargeShape;

        if (charge?.status === 'success') {
          await this.paymentRepo.update(payment.id, {
            payment_reference: reference,
            payment_url: null,
          });
          await this.installments.handleInstallmentPayment(reference);
          await this.transactions.create({
            order_id: plan.order_id,
            user_id: plan.buyer_id,
            vendor_id: plan.vendor_id,
            type: 'installment_payment',
            amount: Number(payment.amount_kobo),
            currency: 'NGN',
            status: 'success',
            description: `Auto-charged installment ${payment.index} (plan ${plan.id})`,
            metadata: { plan_id: plan.id, reference, auto_charge: true },
          });
        } else {
          const retries = plan.charge_retries + 1;
          await this.planRepo.update(plan.id, { charge_retries: retries });
          if (buyer?.email) {
            await this.mail
              .sendAutoChargeFailed({
                email: buyer.email,
                name: buyer.first_name ?? 'Customer',
                planId: plan.id,
                orderId: plan.order_id,
                totalNaira: Number(plan.total_kobo) / 100,
                paidNaira: Number(plan.paid_kobo) / 100,
                amountDueNaira: Number(payment.amount_kobo) / 100,
              })
              .catch(() => undefined);
          }
        }
      } finally {
        await this.cache.releaseLock(lockKey);
      }
    }
  }

  /* ────────────────────────────────────────────────
     3. WARNING LADDER + DEFAULTS
        D+2 → warning 1 · D+5 → warning 2 · D+7 → default + refund
  ──────────────────────────────────────────────── */
  private async processWarningsAndDefaults() {
    const now = new Date();
    const activePlans = await this.planRepo.find({
      where: {
        status: 'active',
        mode: 'manual',
        next_due_date: Not(IsNull()),
      },
      relations: ['order', 'buyer'],
    });

    for (const plan of activePlans) {
      if (!plan.next_due_date) continue;
      const overdueMs = now.getTime() - new Date(plan.next_due_date).getTime();
      const overdueDays = Math.floor(overdueMs / 86400_000);

      if (overdueDays < INSTALLMENT_WARNING_1_DAYS) continue;

      const lockKey = `lock:installment:warn:${plan.id}`;
      const acquired = await this.cache.acquireLock(lockKey, 20);
      if (!acquired) continue;

      try {
        const pendingPayment = await this.paymentRepo.findOne({
          where: { plan_id: plan.id, status: 'pending' },
          order: { index: 'ASC' },
        });
        if (!pendingPayment) continue;

        const buyer = await this.userRepo.findOne({
          where: { id: plan.buyer_id },
        });
        if (!buyer?.email) continue;

        const amountDueNaira = Number(pendingPayment.amount_kobo) / 100;

        if (overdueDays >= INSTALLMENT_DEFAULT_DAYS) {
          await this.installments.defaultPlan(plan);
          this.logger.log(`Defaulted plan ${plan.id}`);
          continue;
        }

        if (
          overdueDays >= INSTALLMENT_WARNING_2_DAYS &&
          plan.warning_level < 2
        ) {
          await this.planRepo.update(plan.id, { warning_level: 2 });
          await this.mail
            .sendReminder({
              email: buyer.email,
              name: buyer.first_name ?? 'Customer',
              planId: plan.id,
              orderId: plan.order_id,
              totalNaira: Number(plan.total_kobo) / 100,
              paidNaira: Number(plan.paid_kobo) / 100,
              amountDueNaira,
              daysLeft: INSTALLMENT_DEFAULT_DAYS - overdueDays,
              final: true,
            })
            .catch(() => undefined);
          continue;
        }

        if (
          overdueDays >= INSTALLMENT_WARNING_1_DAYS &&
          plan.warning_level < 1
        ) {
          await this.planRepo.update(plan.id, { warning_level: 1 });
          await this.mail
            .sendReminder({
              email: buyer.email,
              name: buyer.first_name ?? 'Customer',
              planId: plan.id,
              orderId: plan.order_id,
              totalNaira: Number(plan.total_kobo) / 100,
              paidNaira: Number(plan.paid_kobo) / 100,
              amountDueNaira,
              daysLeft: INSTALLMENT_DEFAULT_DAYS - overdueDays,
              final: false,
            })
            .catch(() => undefined);
        }
      } finally {
        await this.cache.releaseLock(lockKey);
      }
    }
  }
}
