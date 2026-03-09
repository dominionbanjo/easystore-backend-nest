import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from 'src/modules/finance-module/transactions/entities/transaction.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { buildPagination } from 'src/utils/response/pagination.util';

@Injectable()
export class AdminTransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
  ) {}

  async getAllTransactions(
    query: PaginationQueryDto & {
      status?: string;
      type?: string;
      search?: string;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const qb = this.transactionRepo
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.user', 'user')
      .leftJoinAndSelect('tx.vendor', 'vendor')
      .leftJoinAndSelect('vendor.store', 'store')
      .orderBy('tx.created_at', 'DESC');

    if (query.status && query.status !== 'all') {
      qb.andWhere('tx.status = :status', { status: query.status });
    }

    if (query.type && query.type !== 'all') {
      qb.andWhere('tx.type = :type', { type: query.type });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(tx.reference) LIKE :search OR LOWER(tx.description) LIKE :search OR CAST(tx.amount AS TEXT) LIKE :search OR LOWER(user.first_name) LIKE :search OR LOWER(user.last_name) LIKE :search OR LOWER(store.store_name) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      message: 'Transactions retrieved',
      data: buildPagination(rows, total, page, limit),
    };
  }

  async getOne(id: string) {
    const tx = await this.transactionRepo.findOne({
      where: { id },
      relations: ['user', 'vendor', 'vendor.store'],
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return { message: 'Transaction retrieved', data: tx };
  }

  async flagTransaction(id: string) {
    const tx = await this.transactionRepo.findOne({ where: { id } });
    if (!tx) throw new NotFoundException('Transaction not found');

    tx.is_flagged = true;
    await this.transactionRepo.save(tx);

    return {
      message: 'Transaction flagged for review',
      data: { id, is_flagged: true },
    };
  }
}
