import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  FindOptionsWhere,
  EntityManager,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Escrow } from 'src/modules/finance-module/escrow/entities/escrow.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { EscrowService } from 'src/modules/finance-module/escrow/escrow.service';
import { TransactionsService } from 'src/modules/finance-module/transactions/transactions.service';
import { DeliveryService } from 'src/modules/commerce-module/delivery/delivery.service';
import { ProductReadService } from 'src/modules/commerce-module/product/services/product-read.service';
import { ProductWriteService } from 'src/modules/commerce-module/product/services/product-write.service';
import { PaystackService } from 'src/common/services/paystack.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { InstallmentMailService } from 'src/modules/shared-module/email/services/installment-mail.service';
import {
  INSTALLMENT_PRESETS,
  INSTALLMENT_MIN_ORDER_KOBO,
  INSTALLMENT_MAX_CONCURRENT_PLANS,
  INSTALLMENT_DEFAULT_LOCKOUT_DAYS,
  INSTALLMENT_DEPOSIT_EXPIRY_HOURS,
  INSTALLMENT_REFERENCE_PREFIX,
  INSTALLMENT_ORDER_MARKER,
  buildInstallmentAmounts,
  buildInstallmentDueDates,
} from '../installment.constants';
import {
  InstallmentPlan,
  InstallmentPlanStatus,
} from '../entities/installment-plan.entity';
import { InstallmentPayment } from '../entities/installment-payment.entity';

interface PaystackVerifyShape {
  status: string;
  amount: number;
  authorization?: { authorization_code?: string | null } | null;
}

interface PaystackInitShape {
  reference: string;
  authorization_url: string;
  access_code: string;
}

@Injectable()
export class InstallmentService {
  constructor(
    @InjectRepository(InstallmentPlan)
    private readonly planRepo: Repository<InstallmentPlan>,
    @InjectRepository(InstallmentPayment)
    private readonly paymentRepo: Repository<InstallmentPayment>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly dataSource: DataSource,
    private readonly paystack: PaystackService,
    private readonly escrowService: EscrowService,
    private readonly transactions: TransactionsService,
    private readonly delivery: DeliveryService,
    private readonly productRead: ProductReadService,
    private readonly productWrite: ProductWriteService,
    private readonly cache: CacheService,
    private readonly mail: InstallmentMailService,
  ) {}

  /* ────────────────────────────────────────────────
     PUBLIC CONFIG (presets + guardrails)
  ──────────────────────────────────────────────── */
  getConfig() {
    return {
      presets: INSTALLMENT_PRESETS,
      min_order_kobo: INSTALLMENT_MIN_ORDER_KOBO,
      max_concurrent_plans: INSTALLMENT_MAX_CONCURRENT_PLANS,
      default_lockout_days: INSTALLMENT_DEFAULT_LOCKOUT_DAYS,
    };
  }

  /* ────────────────────────────────────────────────
     CREATE PLAN (deposit = installment 1, charged now)
  ──────────────────────────────────────────────── */
  async createPlan(data: {
    buyer_id: string;
    order_id: string;
    preset_id: string;
    mode: 'auto' | 'manual';
  }) {
    const { buyer_id, order_id, preset_id, mode } = data;

    const buyer = await this.userRepo.findOne({
      where: { id: buyer_id },
      select: ['email'],
    });
    if (!buyer?.email) {
      throw new BadRequestException('Buyer email is required for payment');
    }
    const email = buyer.email;

    const preset = INSTALLMENT_PRESETS.find((p) => p.id === preset_id);
    if (!preset) {
      throw new BadRequestException('Invalid installment preset');
    }

    const lockKey = `lock:installment:create:${buyer_id}`;
    const acquired = await this.cache.acquireLock(lockKey, 15);
    if (!acquired) {
      throw new ConflictException(
        'Another installment plan is being created. Please wait.',
      );
    }

    try {
      const order = await this.orderRepo.findOne({ where: { id: order_id } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.buyer_id !== buyer_id) {
        throw new BadRequestException('Order does not belong to you');
      }
      if (order.payment_plan_id) {
        throw new BadRequestException('Order already has an installment plan');
      }
      if (
        order.payment_status !== 'pending' &&
        order.payment_status !== 'unpaid'
      ) {
        throw new BadRequestException(
          'Order is not in a payable state for a plan',
        );
      }

      await this.assertEligibility(buyer_id, order, preset_id);

      const orderItems = order.order_items ?? [];
      const totalKobo = Number(order.total);

      /* Build schedule */
      const amounts = buildInstallmentAmounts(totalKobo, preset.count);
      const dueDates = buildInstallmentDueDates(
        new Date(),
        preset.count,
        preset.interval_days,
      );
      const fees = amounts.map((amount) =>
        this.paystack.calculateTransactionFee(amount),
      );

      /* Reserve stock for every line (atomic, released on failure) */
      try {
        for (const item of orderItems) {
          if (item.variant_id) {
            await this.productWrite.reserveVariantStock(
              item.variant_id,
              Number(item.quantity),
            );
          } else {
            await this.productWrite.reserveStock(
              item.product_id,
              Number(item.quantity),
            );
          }
        }
      } catch (error: unknown) {
        for (const item of orderItems) {
          if (item.variant_id) {
            await this.productWrite
              .releaseVariantReservation(item.variant_id, Number(item.quantity))
              .catch(() => undefined);
          } else {
            await this.productWrite
              .releaseReservation(item.product_id, Number(item.quantity))
              .catch(() => undefined);
          }
        }
        throw error;
      }

      try {
        /* Escrow for the full plan total */
        await this.escrowService.createEscrow({
          order_id: order.id,
          buyer_id,
          vendor_id: order.vendor_id,
          amount: totalKobo,
        });

        /* Plan row */
        const plan = this.planRepo.create({
          id: uuidv4(),
          order_id: order.id,
          buyer_id,
          vendor_id: order.vendor_id,
          store_id: order.store_id,
          total_kobo: totalKobo,
          paid_kobo: 0,
          installments_total: preset.count,
          installments_paid: 0,
          mode,
          preset_id: preset.id,
          next_due_date: dueDates[0],
          status: 'active',
          deposit_expires_at: new Date(
            Date.now() + INSTALLMENT_DEPOSIT_EXPIRY_HOURS * 3600_000,
          ),
          admin_note: null,
        });
        const savedPlan = await this.planRepo.save(plan);

        /* Installment rows + deposit init */
        const firstAmount = amounts[0];
        const firstFee = fees[0];
        const firstDue = dueDates[0];
        const depositRef = this.buildReference();

        const payment = (await this.paystack.initializePayment(
          email,
          firstAmount + firstFee,
          {
            reference: depositRef,
            metadata: {
              plan_id: savedPlan.id,
              installment_index: 1,
              order_type: 'installment',
            },
          },
        )) as PaystackInitShape;

        const firstPayment = this.paymentRepo.create({
          id: uuidv4(),
          plan_id: savedPlan.id,
          index: 1,
          amount_kobo: firstAmount,
          fee_kobo: firstFee,
          due_date: firstDue,
          payment_reference: depositRef,
          payment_url: payment.authorization_url,
          status: 'pending',
        });
        await this.paymentRepo.save(firstPayment);

        for (let i = 1; i < preset.count; i += 1) {
          await this.paymentRepo.save(
            this.paymentRepo.create({
              id: uuidv4(),
              plan_id: savedPlan.id,
              index: i + 1,
              amount_kobo: amounts[i],
              fee_kobo: fees[i],
              due_date: dueDates[i],
              status: 'pending',
            }),
          );
        }

        /* Link order */
        await this.orderRepo.update(order.id, {
          payment_plan_id: savedPlan.id,
          payment_reference: depositRef,
          payment_url: payment.authorization_url,
          payment_access_code: payment.access_code,
          notes: JSON.stringify({
            ...this.parseNotes(order.notes),
            [INSTALLMENT_ORDER_MARKER]: true,
            plan_id: savedPlan.id,
          }),
          payment_status: 'pending',
        });

        await this.transactions.create({
          order_id: order.id,
          user_id: buyer_id,
          vendor_id: order.vendor_id,
          type: 'payment_init',
          amount: firstAmount + firstFee,
          currency: 'NGN',
          status: 'pending',
          description: `Deposit for installment plan ${savedPlan.id} (installment 1 of ${preset.count})`,
          metadata: {
            plan_id: savedPlan.id,
            reference: depositRef,
            installment_index: 1,
          },
        });

        await this.cache.clearPrefix('svc:order');
        await this.cache.clearPrefix('svc:installment');

        return {
          success: true,
          id: savedPlan.id,
          payment_url: payment.authorization_url,
          reference: depositRef,
        };
      } catch (error: unknown) {
        /* Rollback reservations on any failure after reservation */
        for (const item of orderItems) {
          if (item.variant_id) {
            await this.productWrite
              .releaseVariantReservation(item.variant_id, Number(item.quantity))
              .catch(() => undefined);
          } else {
            await this.productWrite
              .releaseReservation(item.product_id, Number(item.quantity))
              .catch(() => undefined);
          }
        }
        throw error;
      }
    } finally {
      await this.cache.releaseLock(lockKey);
    }
  }

  /* ────────────────────────────────────────────────
     ELIGIBILITY GUARDRAILS
  ──────────────────────────────────────────────── */
  private async assertEligibility(
    buyer_id: string,
    order: Order,
    presetId?: string,
  ) {
    if (Number(order.total) < INSTALLMENT_MIN_ORDER_KOBO) {
      throw new BadRequestException(
        `Installment plans require a minimum order value of ₦${(INSTALLMENT_MIN_ORDER_KOBO / 100).toLocaleString()}`,
      );
    }

    /* Store-wide opt-in must be enabled by the vendor */
    const store = await this.storeRepo.findOne({
      where: { id: order.store_id ?? '' },
      select: ['installments_enabled'],
    });
    if (!store?.installments_enabled) {
      throw new BadRequestException(
        'This store does not offer installment payments',
      );
    }

    const activeCount = await this.planRepo.count({
      where: { buyer_id, status: 'active' },
    });
    if (activeCount >= INSTALLMENT_MAX_CONCURRENT_PLANS) {
      throw new BadRequestException(
        `You can have at most ${INSTALLMENT_MAX_CONCURRENT_PLANS} active installment plans`,
      );
    }

    const lockoutCutoff = new Date(
      Date.now() - INSTALLMENT_DEFAULT_LOCKOUT_DAYS * 86400_000,
    );
    const recentDefault = await this.planRepo.findOne({
      where: {
        buyer_id,
        status: 'defaulted',
        defaulted_at: new Date(),
      },
      select: ['id'],
    });
    if (recentDefault) {
      const plan = await this.planRepo.findOne({
        where: { id: recentDefault.id },
        select: ['defaulted_at'],
      });
      if (plan?.defaulted_at && plan.defaulted_at > lockoutCutoff) {
        throw new BadRequestException(
          `You cannot start a new installment plan for ${INSTALLMENT_DEFAULT_LOCKOUT_DAYS} days after a default`,
        );
      }
    }

    /* Every product in the order must be installment-enabled by its vendor,
       and the chosen preset must be offered by ALL of them (vendor subset). */
    const items = order.order_items ?? [];
    let allowedPresets: string[] | null = null;
    for (const item of items) {
      const { product } = await this.productRead.getSingle(item.product_id);
      if (!product?.installment_enabled) {
        throw new BadRequestException(
          `"${product?.name ?? 'A product'}" is not available for installment purchase`,
        );
      }
      const presets = product.installment_presets ?? [];
      if (presets.length === 0) continue; // legacy product — no restriction
      allowedPresets =
        allowedPresets === null
          ? [...presets]
          : allowedPresets.filter((id) => presets.includes(id));
    }
    if (presetId && allowedPresets && !allowedPresets.includes(presetId)) {
      throw new BadRequestException(
        'This payment plan is not offered for this order',
      );
    }
  }

  /* ────────────────────────────────────────────────
     PAY NEXT INSTALLMENT (manual mode)
  ──────────────────────────────────────────────── */
  async payInstallment(data: { plan_id: string; buyer_id: string }) {
    const plan = await this.getOwnedPlan(data.plan_id, data.buyer_id);
    if (plan.status !== 'active') {
      throw new BadRequestException('Plan is not active');
    }

    const buyer = await this.userRepo.findOne({
      where: { id: data.buyer_id },
      select: ['email'],
    });
    if (!buyer?.email) {
      throw new BadRequestException('Buyer email is required for payment');
    }
    const email = buyer.email;

    const payment = await this.paymentRepo.findOne({
      where: { plan_id: plan.id, status: 'pending' },
      order: { index: 'ASC' },
    });
    if (!payment) {
      throw new BadRequestException('No pending installment found');
    }

    const reference = this.buildReference();
    const init = (await this.paystack.initializePayment(
      email,
      Number(payment.amount_kobo) + Number(payment.fee_kobo),
      {
        reference,
        metadata: {
          plan_id: plan.id,
          installment_index: payment.index,
          order_type: 'installment',
        },
      },
    )) as PaystackInitShape;

    await this.paymentRepo.update(payment.id, {
      payment_reference: reference,
      payment_url: init.authorization_url,
    });

    await this.transactions.create({
      order_id: plan.order_id,
      user_id: plan.buyer_id,
      vendor_id: plan.vendor_id,
      type: 'payment_init',
      amount: Number(payment.amount_kobo) + Number(payment.fee_kobo),
      currency: 'NGN',
      status: 'pending',
      description: `Installment ${payment.index} of ${plan.installments_total} (plan ${plan.id})`,
      metadata: {
        plan_id: plan.id,
        reference,
        installment_index: payment.index,
      },
    });

    return {
      success: true,
      payment_url: init.authorization_url,
      reference,
    };
  }

  /* ────────────────────────────────────────────────
     PAY OFF REMAINING BALANCE (early payoff)
  ──────────────────────────────────────────────── */
  async payoff(data: { plan_id: string; buyer_id: string }) {
    const plan = await this.getOwnedPlan(data.plan_id, data.buyer_id);
    if (plan.status !== 'active') {
      throw new BadRequestException('Plan is not active');
    }

    const buyer = await this.userRepo.findOne({
      where: { id: data.buyer_id },
      select: ['email'],
    });
    if (!buyer?.email) {
      throw new BadRequestException('Buyer email is required for payment');
    }
    const email = buyer.email;

    const remaining = Number(plan.total_kobo) - Number(plan.paid_kobo);
    if (remaining <= 0) {
      throw new BadRequestException('Plan already fully paid');
    }

    const fee = this.paystack.calculateTransactionFee(remaining);
    const reference = this.buildReference();

    const init = (await this.paystack.initializePayment(
      email,
      remaining + fee,
      {
        reference,
        metadata: {
          plan_id: plan.id,
          installment_index: plan.installments_total + 1,
          order_type: 'installment',
          payoff: true,
        },
      },
    )) as PaystackInitShape;

    await this.paymentRepo.save(
      this.paymentRepo.create({
        id: uuidv4(),
        plan_id: plan.id,
        index: plan.installments_total + 1,
        amount_kobo: remaining,
        fee_kobo: fee,
        due_date: new Date(),
        payment_reference: reference,
        payment_url: init.authorization_url,
        status: 'pending',
      }),
    );

    return {
      success: true,
      payment_url: init.authorization_url,
      reference,
    };
  }

  /* ────────────────────────────────────────────────
     WEBHOOK / VERIFY — record a successful charge
  ──────────────────────────────────────────────── */
  async handleInstallmentPayment(reference: string) {
    const lockKey = `lock:installment:pay:${reference}`;
    const acquired = await this.cache.acquireLock(lockKey, 30);
    if (!acquired) return { received: true };

    try {
      const payment = await this.paymentRepo.findOne({
        where: { payment_reference: reference },
      });
      if (!payment) {
        throw new NotFoundException(
          `No installment payment found for reference: ${reference}`,
        );
      }
      if (payment.status === 'paid') return { received: true };

      const verification = (await this.paystack.verifyPayment(
        reference,
      )) as unknown as PaystackVerifyShape;
      if (verification.status !== 'success') {
        throw new BadRequestException(
          'Installment payment verification failed',
        );
      }

      const expectedKobo =
        Number(payment.amount_kobo) + Number(payment.fee_kobo);
      if (verification.amount !== expectedKobo) {
        throw new BadRequestException(
          `Installment amount mismatch. Expected ${expectedKobo} kobo, paid ${verification.amount} kobo`,
        );
      }

      await this.recordPaidInstallment(payment, verification);
      return { received: true };
    } finally {
      await this.cache.releaseLock(lockKey);
    }
  }

  /* ────────────────────────────────────────────────
     RECORD PAID INSTALLMENT (+ completion pipeline)
  ──────────────────────────────────────────────── */
  /**
   * Resolve the plan + order a paid installment reference belongs to,
   * for post-verification deep-linking on the frontend.
   */
  async getPaymentContext(reference: string): Promise<{
    plan_id: string;
    order_id: string;
  } | null> {
    const payment = await this.paymentRepo.findOne({
      where: { payment_reference: reference },
      select: ['plan_id'],
    });
    if (!payment) return null;

    const plan = await this.planRepo.findOne({
      where: { id: payment.plan_id },
      select: ['id', 'order_id'],
    });
    if (!plan) return null;

    return { plan_id: plan.id, order_id: plan.order_id };
  }

  private async recordPaidInstallment(
    payment: InstallmentPayment,
    verification: PaystackVerifyShape,
  ) {
    const plan = await this.planRepo.findOne({
      where: { id: payment.plan_id },
      relations: ['order', 'buyer'],
    });
    if (!plan || plan.status !== 'active') return;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(InstallmentPayment, payment.id, {
        status: 'paid',
        paid_at: new Date(),
      });

      const newPaidKobo = Number(plan.paid_kobo) + Number(payment.amount_kobo);
      const installmentsPaid = plan.installments_paid + 1;
      const isComplete = newPaidKobo >= Number(plan.total_kobo);

      await manager.update(InstallmentPlan, plan.id, {
        paid_kobo: newPaidKobo,
        installments_paid: installmentsPaid,
        charge_retries: 0,
        warning_level: 0,
        deposit_expires_at: null,
        next_due_date: isComplete
          ? null
          : await this.nextDueDate(plan.id, manager),
        ...(isComplete
          ? {
              status: 'completed' as InstallmentPlanStatus,
              completed_at: new Date(),
            }
          : {}),
      });

      await this.transactions.create({
        order_id: plan.order_id,
        user_id: plan.buyer_id,
        vendor_id: plan.vendor_id,
        type: 'installment_payment',
        amount: Number(payment.amount_kobo),
        currency: 'NGN',
        status: 'success',
        description: `Installment ${payment.index} of ${plan.installments_total} paid for plan ${plan.id}`,
        metadata: {
          plan_id: plan.id,
          reference: payment.payment_reference,
          installment_index: payment.index,
          fee_kobo: payment.fee_kobo,
        },
      });

      if (isComplete) {
        await this.completePlan(plan);
      } else {
        await manager.update(Order, plan.order_id, {
          payment_status: 'partial',
        });
      }
    });

    /* Auto mode: capture the authorization code for future charges */
    if (
      plan.mode === 'auto' &&
      verification.authorization?.authorization_code
    ) {
      await this.planRepo.update(plan.id, {
        authorization_code: verification.authorization.authorization_code,
      });
    }

    await this.cache.clearPrefix('svc:order');
    await this.cache.clearPrefix('svc:installment');

    const planAfterPayment = await this.planRepo.findOne({
      where: { id: plan.id },
    });

    /* Emails (non-blocking) */
    if (payment.index === 1) {
      const rows = await this.buildScheduleRows(plan.id);
      const nextDue = await this.nextDueDate(plan.id);
      await this.mail
        .sendPlanStarted({
          email: plan.buyer?.email ?? '',
          name: plan.buyer?.first_name ?? 'Customer',
          planId: plan.id,
          orderId: plan.order_id,
          totalNaira: Number(plan.total_kobo) / 100,
          paidNaira: Number(planAfterPayment?.paid_kobo ?? 0) / 100,
          rows,
          nextDue: nextDue ? nextDue.toISOString().slice(0, 10) : '—',
        })
        .catch(() => undefined);
    }
  }

  /* ────────────────────────────────────────────────
     COMPLETION PIPELINE — order paid, escrow funded,
     delivery created, reservations converted to sales
  ──────────────────────────────────────────────── */
  private async completePlan(plan: InstallmentPlan) {
    const order = await this.orderRepo.findOne({
      where: { id: plan.order_id },
      relations: ['buyer', 'vendor', 'store'],
    });
    if (!order) throw new NotFoundException('Order not found');

    await this.orderRepo.update(order.id, {
      payment_status: 'success',
      status: 'paid',
    });

    if (order.escrow_id) {
      await this.escrowService.fundEscrow(order.escrow_id);
    }

    await this.delivery.createDelivery({
      order_id: order.id,
      buyer_id: order.buyer_id!,
      vendor_id: order.vendor_id,
    });

    /* Release reservation + decrement stock (variant-aware) */
    for (const item of order.order_items ?? []) {
      if (item.variant_id) {
        await this.productWrite
          .releaseVariantReservation(item.variant_id, Number(item.quantity))
          .catch(() => undefined);
        await this.productWrite.adjustVariantStock(
          item.variant_id,
          -Number(item.quantity),
        );
      } else {
        await this.productWrite
          .releaseReservation(item.product_id, Number(item.quantity))
          .catch(() => undefined);
        await this.productWrite.adjustStock(
          item.product_id,
          -Number(item.quantity),
        );
      }
    }

    await this.transactions.create({
      order_id: order.id,
      escrow_id: order.escrow_id ?? undefined,
      user_id: order.buyer_id!,
      vendor_id: order.vendor_id,
      type: 'payment_confirmed',
      amount: Number(plan.total_kobo),
      currency: 'NGN',
      status: 'success',
      description: 'Installment plan fully paid — order confirmed',
      metadata: { plan_id: plan.id },
    });

    await this.mail
      .sendPlanCompleted({
        email: order.buyer?.email ?? '',
        name: order.buyer?.first_name ?? 'Customer',
        planId: plan.id,
        orderId: order.id,
        totalNaira: Number(plan.total_kobo) / 100,
        paidNaira: Number(plan.total_kobo) / 100,
        isVendor: false,
      })
      .catch(() => undefined);
    await this.mail
      .sendPlanCompleted({
        email: order.vendor?.email ?? '',
        name: order.vendor?.first_name ?? 'Vendor',
        planId: plan.id,
        orderId: order.id,
        totalNaira: Number(plan.total_kobo) / 100,
        paidNaira: Number(plan.total_kobo) / 100,
        isVendor: true,
      })
      .catch(() => undefined);

    await this.cache.clearPrefix('svc:order');
    await this.cache.clearPrefix('svc:installment');
  }

  /* ────────────────────────────────────────────────
     CANCEL (voluntary) / DEFAULT (violation)
     → full refund of every paid installment
  ──────────────────────────────────────────────── */
  async cancelPlan(data: { plan_id: string; buyer_id: string }) {
    const plan = await this.getOwnedPlan(data.plan_id, data.buyer_id);
    if (plan.status !== 'active') {
      throw new BadRequestException('Only active plans can be canceled');
    }
    await this.terminatePlan(plan, 'canceled');
    return { success: true };
  }

  async defaultPlan(plan: InstallmentPlan) {
    if (plan.status !== 'active') return;
    await this.terminatePlan(plan, 'defaulted');
  }

  private async terminatePlan(
    plan: InstallmentPlan,
    outcome: 'canceled' | 'defaulted',
  ) {
    const order = await this.orderRepo.findOne({
      where: { id: plan.order_id },
      relations: ['buyer', 'vendor', 'store'],
    });
    if (!order) throw new NotFoundException('Order not found');

    /* Refund every paid installment via Paystack transaction refund */
    const paidPayments = await this.paymentRepo.find({
      where: { plan_id: plan.id, status: 'paid' },
    });

    const refundResults: Array<{
      index: number;
      ok: boolean;
      reference: string;
    }> = [];
    for (const payment of paidPayments) {
      if (!payment.payment_reference) continue;
      try {
        await this.paystack.refundTransaction(
          payment.payment_reference,
          Number(payment.amount_kobo),
        );
        await this.paymentRepo.update(payment.id, {
          status: 'refunded',
          refunded_at: new Date(),
        });
        await this.transactions.create({
          order_id: plan.order_id,
          user_id: plan.buyer_id,
          vendor_id: plan.vendor_id,
          type: 'installment_refund',
          amount: Number(payment.amount_kobo),
          currency: 'NGN',
          status: 'success',
          description: `Refund of installment ${payment.index} (plan ${plan.id}) — ${outcome}`,
          metadata: { plan_id: plan.id, reference: payment.payment_reference },
        });
        refundResults.push({
          index: payment.index,
          ok: true,
          reference: payment.payment_reference,
        });
      } catch (error: unknown) {
        refundResults.push({
          index: payment.index,
          ok: false,
          reference: payment.payment_reference,
        });
        console.error(
          `Installment refund failed for ${payment.payment_reference}:`,
          (error as Error).message,
        );
      }
    }

    /* Release all reservations */
    for (const item of order.order_items ?? []) {
      if (item.variant_id) {
        await this.productWrite
          .releaseVariantReservation(item.variant_id, Number(item.quantity))
          .catch(() => undefined);
      } else {
        await this.productWrite
          .releaseReservation(item.product_id, Number(item.quantity))
          .catch(() => undefined);
      }
    }

    /* Escrow → refunded (funds never left Paystack-escrow; ledger closes) */
    if (order.escrow_id) {
      await this.escrowRepo.update(order.escrow_id, {
        status: 'refunded',
        refunded_at: new Date(),
      });
    }

    /* Order + plan state */
    await this.orderRepo.update(order.id, {
      status: 'canceled',
      payment_status: 'refunded',
    });
    await this.planRepo.update(plan.id, {
      status: outcome,
      ...(outcome === 'canceled'
        ? { canceled_at: new Date() }
        : { defaulted_at: new Date() }),
    });

    await this.mail
      .sendDefaultedRefunded({
        email: order.buyer?.email ?? '',
        name: order.buyer?.first_name ?? 'Customer',
        planId: plan.id,
        orderId: order.id,
        totalNaira: Number(plan.total_kobo) / 100,
        paidNaira: Number(plan.paid_kobo) / 100,
      })
      .catch(() => undefined);

    await this.cache.clearPrefix('svc:order');
    await this.cache.clearPrefix('svc:installment');

    return { success: true, refunds: refundResults };
  }

  /* ────────────────────────────────────────────────
     QUERIES — buyer
  ──────────────────────────────────────────────── */
  async listMyPlans(buyer_id: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.planRepo.findAndCount({
      where: { buyer_id },
      relations: ['order'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });
    return {
      success: true,
      data: items.map((p) => this.toPlanView(p)),
      pagination: { page, limit, total },
    };
  }

  async getMyPlan(plan_id: string, buyer_id: string) {
    const plan = await this.getOwnedPlan(plan_id, buyer_id);
    const payments = await this.paymentRepo.find({
      where: { plan_id: plan.id },
      order: { index: 'ASC' },
    });
    return { success: true, data: { ...this.toPlanView(plan), payments } };
  }

  /* ────────────────────────────────────────────────
     QUERIES — vendor / admin
  ──────────────────────────────────────────────── */
  async listVendorPlans(vendor_id: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.planRepo.findAndCount({
      where: { vendor_id },
      relations: ['order', 'buyer'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });
    return {
      success: true,
      data: items.map((p) => this.toPlanView(p)),
      pagination: { page, limit, total },
    };
  }

  async listAllPlans(
    where: FindOptionsWhere<InstallmentPlan>,
    page = 1,
    limit = 10,
  ) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.planRepo.findAndCount({
      where,
      relations: ['order', 'buyer', 'vendor'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });
    return {
      success: true,
      data: items.map((p) => this.toPlanView(p)),
      pagination: { page, limit, total },
    };
  }

  async getPlanForAdmin(plan_id: string) {
    const plan = await this.planRepo.findOne({
      where: { id: plan_id },
      relations: ['order', 'buyer', 'vendor'],
    });
    if (!plan) throw new NotFoundException('Plan not found');
    const payments = await this.paymentRepo.find({
      where: { plan_id },
      order: { index: 'ASC' },
    });
    return { success: true, data: { ...this.toPlanView(plan), payments } };
  }

  /* ────────────────────────────────────────────────
     ADMIN OVERRIDES
  ──────────────────────────────────────────────── */
  async forceComplete(plan_id: string, adminNote: string) {
    const plan = await this.planRepo.findOne({ where: { id: plan_id } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status !== 'active') {
      throw new BadRequestException('Only active plans can be force-completed');
    }
    await this.planRepo.update(plan.id, {
      paid_kobo: Number(plan.total_kobo),
      installments_paid: plan.installments_total,
      next_due_date: null,
      deposit_expires_at: null,
      status: 'completed',
      completed_at: new Date(),
      admin_note: adminNote,
    });
    await this.completePlan(plan);
    return { success: true };
  }

  async forceCancelRefund(plan_id: string, adminNote: string) {
    const plan = await this.planRepo.findOne({ where: { id: plan_id } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.status !== 'active') {
      throw new BadRequestException('Only active plans can be force-canceled');
    }
    await this.planRepo.update(plan.id, { admin_note: adminNote });
    await this.terminatePlan(plan, 'canceled');
    return { success: true };
  }

  /* ────────────────────────────────────────────────
     HELPERS
  ──────────────────────────────────────────────── */
  private buildReference(): string {
    return `${INSTALLMENT_REFERENCE_PREFIX}${uuidv4().replace(/-/g, '')}`;
  }

  /** Public helper used by the cron to release a single line reservation. */
  async releaseReservationFor(
    targetId: string,
    quantity: number,
    isVariant: boolean,
  ): Promise<void> {
    if (isVariant) {
      await this.productWrite.releaseVariantReservation(targetId, quantity);
    } else {
      await this.productWrite.releaseReservation(targetId, quantity);
    }
  }

  private parseNotes(notes: string | null): Record<string, unknown> {
    if (!notes) return {};
    try {
      return JSON.parse(notes) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  private async getOwnedPlan(plan_id: string, buyer_id: string) {
    const plan = await this.planRepo.findOne({ where: { id: plan_id } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.buyer_id !== buyer_id) {
      throw new BadRequestException('Plan does not belong to you');
    }
    return plan;
  }

  private async nextDueDate(
    planId: string,
    manager?: EntityManager,
  ): Promise<Date | null> {
    const repo = manager
      ? manager.getRepository(InstallmentPayment)
      : this.paymentRepo;
    const next = await repo.findOne({
      where: { plan_id: planId, status: 'pending' },
      order: { index: 'ASC' },
      select: ['due_date'],
    });
    return next?.due_date ?? null;
  }

  private async buildScheduleRows(planId: string) {
    const payments = await this.paymentRepo.find({
      where: { plan_id: planId },
      order: { index: 'ASC' },
    });
    return payments.map((p) => ({
      index: p.index,
      amountNaira: Number(p.amount_kobo) / 100,
      dueDate: p.due_date
        ? new Date(p.due_date).toISOString().slice(0, 10)
        : '—',
      status:
        p.status === 'paid'
          ? 'Paid'
          : p.status === 'refunded'
            ? 'Refunded'
            : 'Pending',
    }));
  }

  private toPlanView(plan: InstallmentPlan) {
    return {
      id: plan.id,
      order_id: plan.order_id,
      buyer_id: plan.buyer_id,
      vendor_id: plan.vendor_id,
      store_id: plan.store_id,
      total_kobo: Number(plan.total_kobo),
      paid_kobo: Number(plan.paid_kobo),
      installments_total: plan.installments_total,
      installments_paid: plan.installments_paid,
      mode: plan.mode,
      preset_id: plan.preset_id,
      next_due_date: plan.next_due_date,
      status: plan.status,
      deposit_expires_at: plan.deposit_expires_at,
      defaulted_at: plan.defaulted_at,
      canceled_at: plan.canceled_at,
      completed_at: plan.completed_at,
      admin_note: plan.admin_note,
      created_at: plan.created_at,
      updated_at: plan.updated_at,
    };
  }
}
