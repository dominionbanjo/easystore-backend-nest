import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CacheService } from 'src/cache/cache.service';
import { TransactionsService } from 'src/transactions/transactions.service';

import { Payout } from './entities/payout.entity';

/* -----------------------------------------
 *  Paystack Transfer Payload
 * ----------------------------------------- */
export interface PaystackTransferData {
  id: number;
  amount: number;
  currency: string;
  source: string;
  reason: string | null;
  status: string;
  transfer_code: string;
  reference: string;
  integration: number;
  recipient: number | string;
  domain: string;
  created_at: string;
  updated_at: string;
  failures?: any;
}

/* -----------------------------------------
 *  Create Pending Payout Input
 * ----------------------------------------- */
export interface CreatePendingPayoutInput {
  order_id?: string | null;
  escrow_id?: string | null;
  recipient_code: string;
  amount: number;
  currency?: string;
  transfer_data?: PaystackTransferData | null;
}

@Injectable()
export class PayoutService {
  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,

    private readonly cache: CacheService,
    private readonly transactionService: TransactionsService,
  ) {}

  /* ────────────────────────────────────────────────
     CREATE PENDING PAYOUT
  ──────────────────────────────────────────────── */
  async createPendingPayout({
    order_id,
    escrow_id,
    recipient_code,
    amount,
    currency = 'NGN',
    transfer_data,
  }: CreatePendingPayoutInput): Promise<Payout> {
    if (!recipient_code) {
      throw new BadRequestException('recipient_code is required');
    }

    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid payout amount');
    }

    const payout = this.payoutRepo.create({
      order_id: order_id ?? null,
      escrow_id: escrow_id ?? null,
      transfer_code: transfer_data?.transfer_code ?? null,
      transfer_reference: transfer_data?.reference ?? null,
      recipient_code,
      amount,
      currency,
      status: 'pending',
      metadata: transfer_data ?? null,
    });

    const saved = await this.payoutRepo.save(payout);

    await this.cache.clearPrefix('svc:payout');

    /* 🔑 CRITICAL FIX: null → undefined */
    await this.transactionService.create({
      order_id: order_id ?? undefined,
      escrow_id: escrow_id ?? undefined,
      type: 'payout',
      amount,
      currency,
      reference:
        transfer_data?.transfer_code ?? transfer_data?.reference ?? undefined,
      description: 'Payout initiated (pending)',
      status: 'pending',
      metadata: transfer_data ?? undefined,
    });

    return saved;
  }

  /* ────────────────────────────────────────────────
     FIND PAYOUT BY TRANSFER CODE (CACHED)
  ──────────────────────────────────────────────── */
  async findByTransferCode(transfer_code: string): Promise<Payout | null> {
    if (!transfer_code) {
      throw new BadRequestException('transfer_code is required');
    }

    const cacheKey = `payout:transfer:${transfer_code}`;
    const cached = await this.cache.get<Payout>(cacheKey);
    if (cached) return cached;

    const payout = await this.payoutRepo.findOne({
      where: { transfer_code },
    });

    if (payout) {
      await this.cache.set(cacheKey, payout);
    }

    return payout;
  }

  /* ────────────────────────────────────────────────
     MARK PAYOUT SUCCESS (IDEMPOTENT)
  ──────────────────────────────────────────────── */
  async markSuccess(
    transfer_code: string,
    payload: PaystackTransferData,
  ): Promise<Payout> {
    const payout = await this.findByTransferCode(transfer_code);
    if (!payout) throw new NotFoundException('Payout not found');

    if (payout.status === 'success') return payout;

    payout.status = 'success';
    payout.metadata = {
      ...(payout.metadata ?? {}),
      webhook: payload,
    };

    const updated = await this.payoutRepo.save(payout);
    await this.cache.clearPrefix('svc:payout');

    await this.transactionService.create({
      order_id: payout.order_id ?? undefined,
      escrow_id: payout.escrow_id ?? undefined,
      type: 'payout',
      amount: payout.amount,
      currency: payout.currency ?? 'NGN',
      reference: transfer_code,
      description: 'Payout succeeded',
      status: 'success',
      metadata: payload,
    });

    return updated;
  }

  /* ────────────────────────────────────────────────
     MARK PAYOUT FAILED (IDEMPOTENT)
  ──────────────────────────────────────────────── */
  async markFailed(
    transfer_code: string,
    payload: PaystackTransferData,
  ): Promise<Payout> {
    const payout = await this.findByTransferCode(transfer_code);
    if (!payout) throw new NotFoundException('Payout not found');

    if (payout.status === 'failed') return payout;

    payout.status = 'failed';
    payout.metadata = {
      ...(payout.metadata ?? {}),
      webhook: payload,
    };

    const updated = await this.payoutRepo.save(payout);
    await this.cache.clearPrefix('svc:payout');

    await this.transactionService.create({
      order_id: payout.order_id ?? undefined,
      escrow_id: payout.escrow_id ?? undefined,
      type: 'payout',
      amount: payout.amount,
      currency: payout.currency ?? 'NGN',
      reference: transfer_code,
      description: 'Payout failed',
      status: 'failed',
      metadata: payload,
    });

    return updated;
  }

  /* ────────────────────────────────────────────────
     MARK PAYOUT REVERSED (IDEMPOTENT)
  ──────────────────────────────────────────────── */
  async markReversed(
    transfer_code: string,
    payload: PaystackTransferData,
  ): Promise<Payout> {
    const payout = await this.findByTransferCode(transfer_code);
    if (!payout) throw new NotFoundException('Payout not found');

    if (payout.status === 'reversed') return payout;

    payout.status = 'reversed';
    payout.metadata = {
      ...(payout.metadata ?? {}),
      webhook: payload,
    };

    const updated = await this.payoutRepo.save(payout);
    await this.cache.clearPrefix('svc:payout');

    await this.transactionService.create({
      order_id: payout.order_id ?? undefined,
      escrow_id: payout.escrow_id ?? undefined,
      type: 'payout',
      amount: payout.amount,
      currency: payout.currency ?? 'NGN',
      reference: transfer_code,
      description: 'Payout reversed',
      status: 'reversed',
      metadata: payload,
    });

    return updated;
  }
}
