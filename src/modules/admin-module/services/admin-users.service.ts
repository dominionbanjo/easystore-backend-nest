import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  User,
  AccountStatus,
} from 'src/modules/identity-module/users/entities/user.entity';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { buildPagination } from 'src/utils/response/pagination.util';
import { AccountStatusMailService } from 'src/modules/shared-module/email/services/account-status-mail.service';
import { AdminNotifyMailService } from 'src/modules/shared-module/email/services/admin-notify-mail.service';
import {
  Store,
  StoreStatus,
} from 'src/modules/vendor-module/store/entities/store.entity';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly accountStatusMail: AccountStatusMailService,
    private readonly adminNotifyMail: AdminNotifyMailService,
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
      qb.andWhere('store.status = :status', { status: query.status });
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
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['store'],
    });
    if (!user) throw new NotFoundException('User not found');

    const update: Partial<User> = {
      account_status: newStatus,
      updated_at: new Date(),
    };

    if (newStatus === 'banned') {
      update.token_version = user.token_version + 1;
    }

    await this.userRepo.update(userId, update);

    // Send Status Update Email
    if (
      user.account_type === 'vendor' &&
      newStatus === 'active' &&
      user.store
    ) {
      // Special case for store approval
      this.accountStatusMail
        .sendStoreApprovalEmail({
          name: user.first_name,
          email: user.email,
          storeName: user.store.store_name,
        })
        .catch((e) => console.error('Store Approval Email Error:', e.message));
    } else {
      // General status update
      this.accountStatusMail
        .sendStatusUpdateEmail(
          {
            name: user.first_name,
            email: user.email,
          },
          newStatus,
        )
        .catch((e) => console.error('Status Update Email Error:', e.message));

      // Notify Admin about the change (as requested: "o both admin and the vendors or users")
      this.adminNotifyMail
        .notifyStatusUpdate(
          {
            name: `${user.first_name} ${user.last_name}`,
            email: user.email,
          },
          newStatus,
        )
        .catch((e) => console.error('Admin Status Notify Error:', e.message));
    }

    return {
      message: `User status changed to ${newStatus}`,
      user: { id: user.id, account_status: newStatus },
    };
  }

  async updateStoreStatus(storeId: string, newStatus: StoreStatus) {
    const store = await this.storeRepo.findOne({
      where: { id: storeId },
      relations: ['user'],
    });

    if (!store) throw new NotFoundException('Store not found');

    await this.storeRepo.update(storeId, {
      status: newStatus,
      updated_at: new Date(),
    });

    // If approved, send special email
    if (newStatus === 'active' && store.user) {
      this.accountStatusMail
        .sendStoreApprovalEmail({
          name: store.user.first_name,
          email: store.user.email,
          storeName: store.store_name,
        })
        .catch((e) => console.error('Store Approval Email Error:', e.message));
    } else if (store.user) {
      // General status update for store
      // (Using the same status update email for now, or could create a store-specific one)
      this.accountStatusMail
        .sendStatusUpdateEmail(
          {
            name: store.user.first_name,
            email: store.user.email,
          },
          newStatus as any,
        )
        .catch((e) => console.error('Status Update Email Error:', e.message));
    }

    return {
      message: `Store status changed to ${newStatus}`,
      store: { id: store.id, status: newStatus },
    };
  }
}
