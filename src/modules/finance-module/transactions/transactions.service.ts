import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Transaction } from './entities/transaction.entity';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import { buildPagination } from 'src/utils/response/pagination.util';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  /* ────────────────────────────────────────────────
     CREATE TRANSACTION (ALL TYPES)
     Pass an optional EntityManager to join an open DB transaction —
     required when the transaction row references an entity that is
     still uncommitted inside that transaction (e.g. a new order).
  ──────────────────────────────────────────────── */
  async create(dto: CreateTransactionDto, manager?: EntityManager) {
    const repo = manager
      ? manager.getRepository(Transaction)
      : this.transactionRepo;

    const tx = repo.create({
      id: uuidv4(),
      ...dto,
      currency: dto.currency ?? 'NGN',
      status: dto.status ?? 'pending',
    });

    const saved = await repo.save(tx);

    return {
      success: true,
      id: saved.id,
    };
  }

  /* ────────────────────────────────────────────────
     GET SINGLE TRANSACTION
  ──────────────────────────────────────────────── */
  async getOne(id: string) {
    const tx = await this.transactionRepo.findOne({
      where: { id },
      select: {
        id: true,
        reference: true,
        type: true,
        amount: true,
        currency: true,
        status: true,
        description: true,
        created_at: true,
      },
    });

    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }

    return tx;
  }

  /* ────────────────────────────────────────────────
     LIST TRANSACTIONS (FILTERABLE)
  ──────────────────────────────────────────────── */
  async list(query: ListTransactionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.transactionRepo.createQueryBuilder('tx');

    qb.select([
      'tx.id',
      'tx.reference',
      'tx.type',
      'tx.amount',
      'tx.currency',
      'tx.status',
      'tx.description',
      'tx.created_at',
    ]);

    if (query.order_id) qb.andWhere('tx.order_id = :order_id', query);
    if (query.user_id) qb.andWhere('tx.user_id = :user_id', query);
    if (query.vendor_id) qb.andWhere('tx.vendor_id = :vendor_id', query);
    if (query.type) qb.andWhere('tx.type = :type', query);
    if (query.status) qb.andWhere('tx.status = :status', query);

    const [data, total] = await qb
      .orderBy('tx.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      message: 'Transactions retrieved successfully',
      data: buildPagination(data, total, page, limit),
    };
  }

  /* ────────────────────────────────────────────────
     REVERSE TRANSACTION (NO FK MUTATION)
  ──────────────────────────────────────────────── */
  async reverse(transactionId: string, reason: string) {
    const original = await this.getOne(transactionId);

    if (original.status === 'reversed') {
      throw new BadRequestException('Transaction already reversed');
    }

    const reversal = this.transactionRepo.create({
      id: uuidv4(),
      type: 'refund',
      amount: original.amount,
      currency: original.currency,
      status: 'success',
      order_id: original.order_id,
      escrow_id: original.escrow_id,
      user_id: original.user_id,
      vendor_id: original.vendor_id,
      reference: `rev_${original.id}`,
      description: `Reversal: ${reason}`,
      metadata: {
        reversed_transaction_id: original.id,
      },
    });

    await this.transactionRepo.save(reversal);

    // Mark original as reversed (allowed status update)
    original.status = 'reversed';
    await this.transactionRepo.save(original);

    return { success: true, message: 'Transaction reversed successfully' };
  }
}
