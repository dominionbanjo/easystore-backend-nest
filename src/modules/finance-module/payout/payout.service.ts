import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout, PayoutType } from './entities/payout.entity';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { TransactionsService } from '../transactions/transactions.service';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { buildPagination } from 'src/utils/response/pagination.util';
import { PayoutQueryDto } from './dto/payout-query.dto';

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
  vendor_id?: string | null;
  recipient_code?: string | null;
  amount: number;
  currency?: string;
  payout_type?: PayoutType;
  transfer_data?: PaystackTransferData | null;
}

@Injectable()
export class PayoutService {
  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,

    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    private readonly cache: CacheService,
    private readonly transactionService: TransactionsService,
  ) {}

  /* ────────────────────────────────────────────────
     CREATE PENDING PAYOUT
  ──────────────────────────────────────────────── */
  async createPendingPayout({
    order_id,
    escrow_id,
    vendor_id,
    recipient_code,
    amount,
    currency = 'NGN',
    payout_type = 'manual',
    transfer_data,
  }: CreatePendingPayoutInput): Promise<Payout> {
    if (!amount || amount <= 0) {
      throw new BadRequestException('Invalid payout amount');
    }

    const isManual = payout_type === 'manual';

    const payout = this.payoutRepo.create({
      order_id: order_id ?? null,
      escrow_id: escrow_id ?? null,
      vendor_id: vendor_id ?? null,
      transfer_code: transfer_data?.transfer_code ?? null,
      transfer_reference: transfer_data?.reference ?? null,
      recipient_code: recipient_code ?? null,
      amount,
      currency,
      payout_type,
      status: isManual ? 'pending_manual' : 'pending',
      metadata: transfer_data ?? null,
    });

    const saved = await this.payoutRepo.save(payout);

    await this.cache.clearPrefix('svc:payout');

    await this.transactionService.create({
      order_id: order_id ?? undefined,
      escrow_id: escrow_id ?? undefined,
      type: 'payout',
      amount,
      currency,
      reference:
        transfer_data?.transfer_code ?? transfer_data?.reference ?? undefined,
      description: isManual
        ? 'Manual payout pending (awaiting admin transfer)'
        : 'Payout initiated via Paystack (pending)',
      status: 'pending',
      metadata: (transfer_data ?? undefined) as Record<string, unknown> | undefined,
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
     FIND PAYOUT BY ID
  ──────────────────────────────────────────────── */
  async findById(id: string): Promise<Payout> {
    const payout = await this.payoutRepo.findOne({
      where: { id },
      select: {
        id: true,
        order_id: true,
        amount: true,
        status: true,
        payout_type: true,
        transfer_reference: true,
        created_at: true,
        transferred_at: true,
        currency: true,
        admin_note: true,
      },
      relations: ['vendor'],
    });
    if (!payout) throw new NotFoundException('Payout not found');
    return payout;
  }

  /* ────────────────────────────────────────────────
     GET PENDING MANUAL PAYOUTS (ADMIN)
  ──────────────────────────────────────────────── */
  async getPendingManualPayouts(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await this.payoutRepo.findAndCount({
      where: { status: 'pending_manual', payout_type: 'manual' },
      relations: ['vendor', 'order', 'escrow'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return buildPagination(data, total, page, limit);
  }

  /* ────────────────────────────────────────────────
     MARK PAYOUT AS MANUALLY TRANSFERRED (ADMIN)
  ──────────────────────────────────────────────── */
  async markManuallyTransferred(
    payout_id: string,
    admin_note?: string,
  ) {
    const payout = await this.findById(payout_id);

    if (payout.status === 'success') return { success: true }; // idempotent

    if (payout.payout_type !== 'manual') {
      throw new BadRequestException(
        'This payout is not a manual payout. Use the Paystack webhook flow.',
      );
    }

    payout.status = 'success';
    payout.transferred_at = new Date();
    payout.admin_note = admin_note ?? null;

    const updated = await this.payoutRepo.save(payout);
    await this.cache.clearPrefix('svc:payout');

    // Mark the linked order as completed
    if (payout.order_id) {
      await this.orderRepo.update(payout.order_id, { status: 'completed' });
    }

    await this.transactionService.create({
      order_id: payout.order_id ?? undefined,
      escrow_id: payout.escrow_id ?? undefined,
      type: 'payout',
      amount: payout.amount,
      currency: payout.currency ?? 'NGN',
      description: `Manual payout confirmed by admin${admin_note ? ': ' + admin_note : ''}`,
      status: 'success',
    });

    return { success: true };
  }

  /* ────────────────────────────────────────────────
     MARK PAYOUT SUCCESS (IDEMPOTENT — AUTO PAYSTACK)
  ──────────────────────────────────────────────── */
  async markSuccess(
    transfer_code: string,
    payload: PaystackTransferData,
  ) {
    const payout = await this.findByTransferCode(transfer_code);
    if (!payout) throw new NotFoundException('Payout not found');

    if (payout.status === 'success') return { success: true };

    payout.status = 'success';
    payout.metadata = {
      ...(payout.metadata ?? {}),
      webhook: payload,
    };

    await this.payoutRepo.save(payout);
    await this.cache.clearPrefix('svc:payout');

    await this.transactionService.create({
      order_id: payout.order_id ?? undefined,
      escrow_id: payout.escrow_id ?? undefined,
      type: 'payout',
      amount: payout.amount,
      currency: payout.currency ?? 'NGN',
      reference: transfer_code,
      description: 'Payout succeeded (Paystack)',
      status: 'success',
      metadata: payload as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  /* ────────────────────────────────────────────────
     MARK PAYOUT FAILED (IDEMPOTENT)
  ──────────────────────────────────────────────── */
  async markFailed(
    transfer_code: string,
    payload: PaystackTransferData,
  ) {
    const payout = await this.findByTransferCode(transfer_code);
    if (!payout) throw new NotFoundException('Payout not found');

    if (payout.status === 'failed') return { success: true };

    payout.status = 'failed';
    payout.metadata = {
      ...(payout.metadata ?? {}),
      webhook: payload,
    };

    await this.payoutRepo.save(payout);
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
      metadata: payload as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  /* ────────────────────────────────────────────────
     MARK PAYOUT REVERSED (IDEMPOTENT)
  ──────────────────────────────────────────────── */
  async markReversed(
    transfer_code: string,
    payload: PaystackTransferData,
  ) {
    const payout = await this.findByTransferCode(transfer_code);
    if (!payout) throw new NotFoundException('Payout not found');

    if (payout.status === 'reversed') return { success: true };

    payout.status = 'reversed';
    payout.metadata = {
      ...(payout.metadata ?? {}),
      webhook: payload,
    };

    await this.payoutRepo.save(payout);
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
      metadata: payload as unknown as Record<string, unknown>,
    });

    return { success: true };
  }

  /* ────────────────────────────────────────────────
     GET PAYOUTS BY VENDOR (BUYER)
  ──────────────────────────────────────────────── */
  async getVendorPayouts(vendor_id: string, query?: PayoutQueryDto) {
    const page = query?.page || 1;
    const limit = query?.limit || 10;
    const skip = (page - 1) * limit;

    const qb = this.payoutRepo.createQueryBuilder('payout');
    qb.select([
      'payout.id',
      'payout.order_id',
      'payout.amount',
      'payout.status',
      'payout.payout_type',
      'payout.transfer_reference',
      'payout.created_at',
      'payout.transferred_at',
      'payout.currency',
      'payout.admin_note',
    ]);
    qb.leftJoin('payout.order', 'order');
    qb.leftJoin('payout.escrow', 'escrow');

    qb.where('payout.vendor_id = :vendor_id', { vendor_id });

    if (query?.status && query.status !== 'all') {
      qb.andWhere('payout.status = :status', { status: query.status });
    }

    if (query?.search) {
      qb.andWhere(
        '(payout.transfer_reference ILIKE :search OR payout.transfer_code ILIKE :search OR CAST(payout.order_id AS TEXT) ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('payout.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return buildPagination(data, total, page, limit);
  }
}
