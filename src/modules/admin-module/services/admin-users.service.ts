import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  User,
  AccountStatus,
} from 'src/modules/identity-module/users/entities/user.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { buildPagination } from 'src/utils/response/pagination.util';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private buildBaseQuery(type?: string) {
    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.store', 'store')
      .orderBy('user.created_at', 'DESC');

    if (type) {
      qb.andWhere('user.account_type = :type', { type });
    }

    return qb;
  }

  async getAllUsers(
    query: PaginationQueryDto & {
      status?: string;
      type?: string;
      search?: string;
    },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const qb = this.buildBaseQuery(
      query.type && query.type !== 'all' ? query.type : undefined,
    )
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status && query.status !== 'all') {
      qb.andWhere('user.account_status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(user.first_name) LIKE :search OR LOWER(user.last_name) LIKE :search OR LOWER(user.email) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      message: 'Users retrieved',
      data: buildPagination(rows, total, page, limit),
    };
  }

  async getAllVendors(
    query: PaginationQueryDto & { status?: string; search?: string },
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;

    const qb = this.buildBaseQuery('vendor')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status && query.status !== 'all') {
      qb.andWhere('user.account_status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(user.first_name) LIKE :search OR LOWER(user.last_name) LIKE :search OR LOWER(user.email) LIKE :search OR LOWER(store.store_name) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      message: 'Vendors retrieved',
      data: buildPagination(rows, total, page, limit),
    };
  }

  async getOne(userId: string) {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.store', 'store')
      .where('user.id = :userId', { userId })
      .getOne();

    if (!user) throw new NotFoundException('User not found');

    return { message: 'User retrieved', data: user };
  }

  async updateUserStatus(userId: string, newStatus: AccountStatus) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const update: Partial<User> = {
      account_status: newStatus,
      updated_at: new Date(),
    };

    if (newStatus === 'banned') {
      update.token_version = user.token_version + 1;
    }

    await this.userRepo.update(userId, update);

    return {
      message: `User status changed to ${newStatus}`,
      user: { id: user.id, account_status: newStatus },
    };
  }
}
