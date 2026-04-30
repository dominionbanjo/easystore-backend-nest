import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PaystackService } from 'src/common/services/paystack.service';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { UsersService } from 'src/modules/identity-module/users/users.service';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { EscrowMailService } from 'src/modules/shared-module/email/services/escrow-mail.service';
import { Repository } from 'typeorm';
import { PayoutService } from '../payout/payout.service';
import { TransactionsService } from '../transactions/transactions.service';
import { Escrow, EscrowPayoutType } from './entities/escrow.entity';
import { StoreService } from 'src/modules/vendor-module/store/services/store.service';

/** Escrow fee rate: 3% of total, capped at ₦3,000 (300,000 kobo) */
const ESCROW_FEE_RATE = 0.03;
const ESCROW_FEE_CAP_KOBO = 300_000; // ₦3,000

@Injectable()
export class EscrowService {
  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    private readonly payoutService: PayoutService,
    private readonly paystack: PaystackService,
    private readonly storeService: StoreService,
    private readonly mail: EscrowMailService,
    private readonly cache: CacheService,
    private readonly transactions: TransactionsService,
    private readonly users: UsersService,
  ) {}

  /* ────────────────────────────────────────────────
     COMPUTE ESCROW FEE
     3% of amount in kobo, capped at 300,000 kobo (₦3,000)
  ──────────────────────────────────────────────── */
  computeEscrowFee(amountKobo: number): number {
    return Math.min(Math.round(amountKobo * ESCROW_FEE_RATE), ESCROW_FEE_CAP_KOBO);
  }

  /* ────────────────────────────────────────────────
     1️⃣ CREATE ESCROW (IDEMPOTENT)
  ──────────────────────────────────────────────── */
  async createEscrow(data: {
    order_id: string;
    buyer_id: string;
    vendor_id: string;
    amount: number;
    payout_type?: EscrowPayoutType;
  }) {
    const { order_id, buyer_id, vendor_id, amount, payout_type = 'manual' } = data;

    if (!order_id || !buyer_id || !vendor_id) {
      throw new BadRequestException('Missing escrow fields');
    }

    const cacheKey = `escrow:order:${order_id}`;
    const cached = await this.cache.get<Escrow>(cacheKey);
    if (cached) return cached;

    const existing = await this.escrowRepo.findOne({ where: { order_id } });
    if (existing) {
      await this.cache.set(cacheKey, existing);
      return existing;
    }

    const escrow_fee = this.computeEscrowFee(amount);

    const escrow = this.escrowRepo.create({
      order_id,
      buyer_id,
      vendor_id,
      amount,
      escrow_fee,
      payout_type,
      release_code: this.generateCode(),
      status: 'pending',
    });

    const saved = await this.escrowRepo.save(escrow);

    await this.transactions.create({
      order_id,
      escrow_id: saved.id,
      user_id: buyer_id,
      vendor_id,
      type: 'escrow_hold',
      amount,
      currency: 'NGN',
      status: 'pending',
      description: `Escrow created for order ${order_id} (fee: ₦${(escrow_fee / 100).toLocaleString()})`,
    });

    await this.cache.set(cacheKey, saved);
    return saved;
  }

  /* ────────────────────────────────────────────────
     2️⃣ GET ESCROW (CACHED)
  ──────────────────────────────────────────────── */
  async getEscrow(id: string) {
    const key = `escrow:${id}`;
    const cached = await this.cache.get<Escrow>(key);
    if (cached) return cached;

    const escrow = await this.escrowRepo.findOne({ where: { id } });
    if (!escrow) throw new NotFoundException('Escrow not found');

    await this.cache.set(key, escrow);
    return escrow;
  }

  /* ────────────────────────────────────────────────
     3️⃣ FUND ESCROW
  ──────────────────────────────────────────────── */
  async fundEscrow(id: string) {
    const escrow = await this.getEscrow(id);
    if (escrow.status === 'funded') return escrow;

    escrow.status = 'funded';
    const updated = await this.escrowRepo.save(escrow);

    await this.transactions.create({
      order_id: escrow.order_id!,
      escrow_id: escrow.id,
      user_id: escrow.buyer_id,
      vendor_id: escrow.vendor_id,
      type: 'payment',
      amount: escrow.amount,
      currency: 'NGN',
      status: 'success',
      description: 'Escrow funded',
    });

    await this.cache.clearPrefix('escrow');

    const buyer = await this.users.findById(escrow.buyer_id);
    const vendor = await this.users.findById(escrow.vendor_id);
    const store = await this.storeService.getStoreByUser(escrow.vendor_id);
    const order = await this.orderRepo.findOne({ where: { id: escrow.order_id! } });

    const vendorName = store?.store_name ?? vendor?.first_name ?? 'Vendor';
    const buyerName = buyer?.first_name ?? 'Customer';
    const orderItems = (order?.order_items ?? []) as any[];

    if (buyer?.email) {
      await this.mail.sendEscrowFundedBuyer({
        email: buyer.email,
        name: buyerName,
        order_id: escrow.order_id!,
        order_items: orderItems,
        total_amount: escrow.amount,
      });
    }

    if (vendor?.email) {
      await this.mail.sendEscrowFundedVendor({
        email: vendor.email,
        name: vendorName,
        order_id: escrow.order_id!,
        order_items: orderItems,
        buyer_name: buyerName,
        amount: escrow.amount,
      });
    }

    return updated;
  }

  /* ────────────────────────────────────────────────
     4️⃣ MARK DELIVERED (START HOLD)
  ──────────────────────────────────────────────── */
  async markDelivered(order_id: string) {
    const order = await this.orderRepo.findOne({ where: { id: order_id } });
    if (!order?.escrow_id) {
      throw new BadRequestException('Order has no escrow');
    }

    const escrow = await this.getEscrow(order.escrow_id);
    if (escrow.status === 'delivered') return escrow;

    escrow.status = 'delivered';
    escrow.hold_until = new Date(Date.now() + 3 * 86400000); // 3 days

    const updated = await this.escrowRepo.save(escrow);

    await this.transactions.create({
      order_id,
      escrow_id: escrow.id,
      user_id: escrow.buyer_id,
      vendor_id: escrow.vendor_id,
      type: 'escrow_hold',
      amount: escrow.amount,
      currency: 'NGN',
      status: 'success',
      description: 'Escrow hold started — awaiting buyer OTP release',
    });

    await this.cache.clearPrefix('escrow');
    return updated;
  }

  /* ────────────────────────────────────────────────
     5️⃣ RELEASE ESCROW (BUYER OTP)
     ─ Manual mode: creates pending_manual payout
       and notifies admin. Order is NOT completed yet.
     ─ Auto mode (future): initiates Paystack transfer.
  ──────────────────────────────────────────────── */
  async releaseEscrow(order_id: string, code: string) {
    const order = await this.orderRepo.findOne({ where: { id: order_id } });
    if (!order?.escrow_id) {
      throw new BadRequestException('Order has no escrow');
    }

    const escrow = await this.getEscrow(order.escrow_id);

    if (escrow.disabled) {
      throw new BadRequestException('Escrow is locked due to too many failed attempts');
    }

    if (escrow.release_code !== code) {
      escrow.trial_count += 1;
      escrow.disabled = escrow.trial_count >= 4;
      await this.escrowRepo.save(escrow);
      throw new BadRequestException('Invalid release code');
    }

    if (escrow.status !== 'delivered') {
      throw new BadRequestException('Escrow not releasable — order must be marked delivered first');
    }

    const store = await this.storeService.getStoreByUser(order.vendor_id);
    const vendor = await this.users.findById(order.vendor_id);
    const buyer = await this.users.findById(order.buyer_id!);
    const vendorName = store?.store_name ?? vendor?.first_name ?? 'Vendor';

    // ── MANUAL MODE (Default) ───────────────────────
    if (escrow.payout_type === 'manual') {
      // Create a pending_manual payout record
      const payout = await this.payoutService.createPendingPayout({
        order_id: order.id,
        escrow_id: escrow.id,
        vendor_id: order.vendor_id,
        recipient_code: store?.recipient_code ?? null,
        amount: escrow.amount,
        currency: 'NGN',
        payout_type: 'manual',
      });

      // Mark escrow as released
      escrow.status = 'released';
      escrow.released_at = new Date();
      escrow.trial_count = 0;
      escrow.disabled = false;
      await this.escrowRepo.save(escrow);
      await this.cache.clearPrefix('escrow');

      // NOTE: Order is NOT marked completed here.
      // It will be marked completed only when admin marks the payout as transferred.

      // ── Notify Admin ──
      await this.mail.sendEscrowReleaseRequestAdmin({
        payout_id: payout.id,
        order_id: order.id,
        vendor_name: vendorName,
        vendor_bank_name: store?.bank_name ?? 'Unknown Bank',
        vendor_account_number: store?.account_number ?? 'N/A',
        vendor_account_name: vendor?.first_name
          ? `${vendor.first_name} ${vendor.last_name ?? ''}`.trim()
          : vendorName,
        amount_kobo: escrow.amount,
      });

      // ── Notify Buyer ──
      if (buyer?.email) {
        await this.mail.sendEscrowReleasedVendor({
          email: buyer.email,
          name: buyer.first_name ?? 'Customer',
          order_id: order.id,
          amount: escrow.amount,
        });
      }

      // ── Notify Vendor ──
      if (vendor?.email) {
        await this.mail.sendPaymentIncomingVendor({
          email: vendor.email,
          name: vendorName,
          order_id: order.id,
          amount: escrow.amount,
        });
      }

      return {
        success: true,
        payout_type: 'manual',
        payout_status: 'pending_manual',
        payout_id: payout.id,
        message: 'Escrow released. Admin has been notified and will process the transfer.',
      };
    }

    // ── AUTO MODE (Paystack — for future re-enablement) ─────────
    if (!store?.recipient_code) {
      throw new BadRequestException('Vendor has no Paystack payout account configured');
    }

    const transfer = await this.paystack.initiateTransfer({
      recipient_code: store.recipient_code,
      amountKobo: escrow.amount,
      reason: `Payout for order ${order.id}`,
    });

    await this.payoutService.createPendingPayout({
      order_id: order.id,
      escrow_id: escrow.id,
      vendor_id: order.vendor_id,
      recipient_code: store.recipient_code,
      amount: escrow.amount,
      currency: 'NGN',
      payout_type: 'auto',
      transfer_data: transfer,
    });

    escrow.status = 'released';
    escrow.released_at = new Date();
    escrow.trial_count = 0;
    escrow.disabled = false;
    await this.escrowRepo.save(escrow);

    await this.orderRepo.update(order.id, { status: 'completed' });
    await this.cache.clearPrefix('escrow');

    return {
      success: true,
      payout_type: 'auto',
      payout_status: transfer.ok ? 'pending' : 'failed',
      payout_reference: transfer.reference,
    };
  }

  /* ────────────────────────────────────────────────
     6️⃣ REFUND ESCROW
  ──────────────────────────────────────────────── */
  async refundEscrow(escrow_id: string, requestedBy: string) {
    const escrow = await this.getEscrow(escrow_id);

    if (escrow.status !== 'funded') {
      throw new BadRequestException('Escrow not refundable — must be in funded status');
    }

    const order = await this.orderRepo.findOne({
      where: { id: escrow.order_id! },
    });
    if (!order) throw new NotFoundException('Order not found');

    const buyer = await this.users.findById(escrow.buyer_id);

    // For refunds, always use auto mode (Paystack transfer back to buyer)
    const transfer = await this.paystack.initiateTransfer({
      recipient_code: buyer!.recipient_code!,
      amountKobo: escrow.amount,
      reason: `Refund for order ${order.id}`,
    });

    await this.payoutService.createPendingPayout({
      order_id: order.id,
      escrow_id: escrow.id,
      vendor_id: order.vendor_id,
      recipient_code: buyer!.recipient_code!,
      amount: escrow.amount,
      currency: 'NGN',
      payout_type: 'auto',
      transfer_data: transfer,
    });

    escrow.status = 'refunded';
    escrow.refunded_at = new Date();

    await this.escrowRepo.save(escrow);
    await this.cache.clearPrefix('escrow');

    return {
      success: true,
      payout_status: transfer.ok ? 'pending' : 'failed',
      payout_reference: transfer.reference,
    };
  }

  /* ────────────────────────────────────────────────
     INTERNAL
  ──────────────────────────────────────────────── */
  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}
