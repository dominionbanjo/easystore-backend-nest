import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payout } from 'src/modules/finance-module/payout/entities/payout.entity';
import { Escrow } from 'src/modules/finance-module/escrow/entities/escrow.entity';
import { PayoutService } from 'src/modules/finance-module/payout/payout.service';
import { EscrowMailService } from 'src/modules/shared-module/email/services/escrow-mail.service';
import { UsersService } from 'src/modules/identity-module/users/users.service';
import { StoreService } from 'src/modules/vendor-module/store/services/store.service';
import { buildPagination } from 'src/utils/response/pagination.util';

@Injectable()
export class AdminEscrowService {
  constructor(
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,

    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,

    private readonly payoutService: PayoutService,
    private readonly mail: EscrowMailService,
    private readonly users: UsersService,
    private readonly storeService: StoreService,
  ) {}

  /* ────────────────────────────────────────────────
     GET PENDING MANUAL PAYOUTS
  ──────────────────────────────────────────────── */
  async getPendingManualPayouts(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [payouts, total] = await this.payoutRepo.findAndCount({
      where: { status: 'pending_manual', payout_type: 'manual' },
      relations: ['vendor', 'order', 'escrow'],
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    const enriched = await Promise.all(
      payouts.map(async (payout) => {
        let store: any = null;
        if (payout.vendor_id) {
          store = await this.storeService.getStoreByUser(payout.vendor_id).catch(() => null);
        }

        return {
          ...payout,
          amount_kobo: payout.amount, // Map core amount to UI expectation
          vendor_bank: store
            ? {
                store_name: store.store_name,
                bank_name: store.bank_name,
                account_number: store.account_number,
                account_name: payout.vendor
                  ? `${payout.vendor.first_name ?? ''} ${payout.vendor.last_name ?? ''}`.trim()
                  : null,
              }
            : null,
        };
      }),
    );

    return {
      message: 'Pending manual payouts retrieved',
      data: buildPagination(enriched, total, page, limit),
    };
  }

  /* ────────────────────────────────────────────────
     MARK PAYOUT AS MANUALLY TRANSFERRED
  ──────────────────────────────────────────────── */
  async markAsTransferred(payout_id: string, admin_note?: string) {
    const payout = await this.payoutRepo.findOne({
      where: { id: payout_id },
      relations: ['vendor', 'order'],
    });

    if (!payout) throw new NotFoundException('Payout not found');

    const updated = await this.payoutService.markManuallyTransferred(
      payout_id,
      admin_note,
    );

    if (payout.vendor_id) {
      const vendor = await this.users.findById(payout.vendor_id);
      const store = await this.storeService.getStoreByUser(payout.vendor_id).catch(() => null);
      const vendorName = store?.store_name ?? vendor?.first_name ?? 'Vendor';

      if (vendor?.email) {
        await this.mail.sendPaymentConfirmedVendor({
          email: vendor.email,
          name: vendorName,
          order_id: payout.order_id ?? 'N/A',
          amount: payout.amount,
        });
      }
    }

    return {
      success: true,
      message: 'Payout marked as transferred. Vendor notified.',
      payout: updated,
    };
  }

  /* ────────────────────────────────────────────────
     GET ALL ESCROWS (ADMIN)
  ──────────────────────────────────────────────── */
  async getAllEscrows(page = 1, limit = 20, status?: string, search?: string) {
    const skip = (page - 1) * limit;

    const qb = this.escrowRepo.createQueryBuilder('escrow');
    qb.leftJoinAndSelect('escrow.order', 'order');
    qb.leftJoinAndSelect('escrow.buyer', 'buyer');
    qb.leftJoinAndSelect('escrow.vendor', 'vendor');
    qb.leftJoinAndSelect('vendor.stores', 'vendor_store');

    if (status && status !== 'all') {
      qb.andWhere('escrow.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(CAST(escrow.order_id AS TEXT) ILIKE :search OR buyer.first_name ILIKE :search OR buyer.last_name ILIKE :search OR vendor_store.store_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('escrow.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      message: 'Escrows retrieved',
      data: buildPagination(data, total, page, limit),
    };
  }

  /* ────────────────────────────────────────────────
     GET ALL PAYOUTS (ADMIN)
  ──────────────────────────────────────────────── */
  async getAllPayouts(page = 1, limit = 20, status?: string, search?: string) {
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const qb = this.payoutRepo.createQueryBuilder('payout');
    qb.leftJoinAndSelect('payout.vendor', 'vendor');
    qb.leftJoinAndSelect('vendor.stores', 'store');
    qb.leftJoinAndSelect('payout.order', 'order');

    if (status && status !== 'all') {
      qb.andWhere('payout.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(CAST(payout.id AS TEXT) ILIKE :search OR payout.reference ILIKE :search OR vendor.first_name ILIKE :search OR vendor.last_name ILIKE :search OR store.store_name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('payout.created_at', 'DESC');
    qb.skip(skip).take(limitNum);

    const [data, total] = await qb.getManyAndCount();

    return {
      message: 'Payouts retrieved',
      data: buildPagination(
        data.map((p) => ({
          id: p.id,
          amount_kobo: p.amount,
          status: p.status,
          created_at: p.created_at,
          updated_at: p.updated_at,
          reference: p.transfer_reference ?? p.transfer_code,
          payout_type: p.payout_type,
          vendor: p.vendor,
          vendor_bank: p.vendor?.stores?.[0]
            ? {
                store_name: p.vendor.stores[0].store_name,
                bank_name: p.vendor.stores[0].bank_name,
                account_number: p.vendor.stores[0].account_number,
                account_name: p.vendor.stores[0].account_number
              }
            : null,
        })),
        total,
        pageNum,
        limitNum,
      ),
    };
  }
}
