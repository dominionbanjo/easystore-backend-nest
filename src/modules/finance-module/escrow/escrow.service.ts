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
import { Escrow } from './entities/escrow.entity';
import { StoreService } from 'src/modules/vendor-module/store/services/store.service';

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
     1️⃣ CREATE ESCROW (IDEMPOTENT)
  ──────────────────────────────────────────────── */
  async createEscrow(data: {
    order_id: string;
    buyer_id: string;
    vendor_id: string;
    amount: number;
  }) {
    const { order_id, buyer_id, vendor_id, amount } = data;

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

    const escrow = this.escrowRepo.create({
      order_id,
      buyer_id,
      vendor_id,
      amount,
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
      description: `Escrow created for order ${order_id}`,
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

    const vendorName = store?.store_name ?? vendor?.first_name ?? 'Vendor';

    if (buyer?.email) {
      await this.mail.sendEscrowFundedBuyer({
        email: buyer.email,
        name: buyer.first_name ?? 'Customer',
        order_id: escrow.order_id!,
      });
    }

    if (vendor?.email) {
      await this.mail.sendEscrowFundedVendor({
        email: vendor.email,
        name: vendorName,
        order_id: escrow.order_id!,
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
    escrow.hold_until = new Date(Date.now() + 3 * 86400000);

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
      description: 'Escrow hold started',
    });

    await this.cache.clearPrefix('escrow');
    return updated;
  }

  /* ────────────────────────────────────────────────
     5️⃣ RELEASE ESCROW
  ──────────────────────────────────────────────── */
  async releaseEscrow(order_id: string, code: string) {
    const order = await this.orderRepo.findOne({ where: { id: order_id } });
    if (!order?.escrow_id) {
      throw new BadRequestException('Order has no escrow');
    }

    const escrow = await this.getEscrow(order.escrow_id);

    if (escrow.disabled) {
      throw new BadRequestException('Escrow is locked');
    }

    if (escrow.release_code !== code) {
      escrow.trial_count += 1;
      escrow.disabled = escrow.trial_count >= 4;
      await this.escrowRepo.save(escrow);
      throw new BadRequestException('Invalid release code');
    }

    if (escrow.status !== 'delivered') {
      throw new BadRequestException('Escrow not releasable');
    }

    const store = await this.storeService.getStoreByUser(order.vendor_id);
    if (!store.recipient_code) {
      throw new BadRequestException('Vendor has no payout account');
    }

    const transfer = await this.paystack.initiateTransfer({
      recipient_code: store.recipient_code,
      amountKobo: escrow.amount,
      reason: `Payout for order ${order.id}`,
    });

    await this.payoutService.createPendingPayout({
      order_id: order.id,
      escrow_id: escrow.id,
      recipient_code: store.recipient_code,
      amount: escrow.amount,
      currency: 'NGN',
      transfer_data: transfer,
    });

    escrow.status = 'released';
    escrow.released_at = new Date();
    escrow.trial_count = 0;
    escrow.disabled = false;

    await this.escrowRepo.save(escrow);

    await this.orderRepo.update(order.id, {
      status: 'completed',
    });

    await this.cache.clearPrefix('escrow');

    return {
      success: true,
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
      throw new BadRequestException('Escrow not refundable');
    }

    const order = await this.orderRepo.findOne({
      where: { id: escrow.order_id! },
    });
    if (!order) throw new NotFoundException('Order not found');

    const buyer = await this.users.findById(escrow.buyer_id);

    const transfer = await this.paystack.initiateTransfer({
      recipient_code: buyer!.recipient_code!,
      amountKobo: escrow.amount,
      reason: `Refund for order ${order.id}`,
    });

    await this.payoutService.createPendingPayout({
      order_id: order.id,
      escrow_id: escrow.id,
      recipient_code: buyer!.recipient_code!,
      amount: escrow.amount,
      currency: 'NGN',
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
