import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { StoreStaff, StaffStatus } from '../entities/store-staff.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Store } from '../entities/store.entity';
import { buildPagination } from 'src/utils/response/pagination.util';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { StaffInviteMailService } from 'src/modules/shared-module/email/services/staff-invite-mail.service';

@Injectable()
export class StoreStaffService {
  constructor(
    @InjectRepository(StoreStaff)
    private readonly staffRepo: Repository<StoreStaff>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly dataSource: DataSource,
    private readonly cache: CacheService,
    private readonly inviteMail: StaffInviteMailService,
  ) {}

  // Generate a random temporary password
  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async inviteStaff(storeId: string, data: { email: string; first_name: string; last_name: string; password?: string }) {
    const { email, first_name, last_name, password } = data;

    // Check store exists
    const store = await this.storeRepo.findOne({ where: { id: storeId }, select: { id: true, store_name: true } });
    if (!store) throw new NotFoundException('Store not found');

    // Check email not already used
    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (existingUser) {
      // Check if already staff of this store
      const existingStaff = await this.staffRepo.findOne({ where: { store_id: storeId, user_id: existingUser.id } });
      if (existingStaff) throw new BadRequestException('User is already a staff member of this store');
    }

    const plainPassword = password || this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const username = `staff_${email.split('@')[0]}_${Date.now()}`.toLowerCase().replace(/[^a-z0-9_]/g, '');

    return this.dataSource.transaction(async (manager) => {
      // Create or reuse user
      let user = existingUser;
      if (!user) {
        user = manager.create(User, {
          email,
          first_name,
          last_name,
          password: hashedPassword,
          username,
          account_type: 'staff' as any,
          account_status: 'active',
          email_verified: true,
          must_change_password: true,
        });
        user = await manager.save(User, user);
      } else {
        await manager.update(User, user.id, {
          first_name,
          last_name,
          password: hashedPassword,
          account_type: 'staff' as any,
          account_status: 'active',
          must_change_password: true,
          token_version: user.token_version + 1,
        });
      }

      // Create staff record
      const staff = manager.create(StoreStaff, {
        store_id: storeId,
        user_id: user.id,
        status: 'active',
      });
      const saved = await manager.save(StoreStaff, staff);

      // Send invite email (only if auto-generated password)
      if (!password) {
        await this.inviteMail.sendInviteEmail({
          email,
          name: `${first_name} ${last_name}`,
          storeName: store.store_name,
          tempPassword: plainPassword,
        });
      }

      await this.cache.clearPrefix('svc:staff');

      return { success: true, id: saved.id };
    });
  }

  async listStaff(storeId: string, query: { page?: number; limit?: number; status?: string; search?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.staffRepo.createQueryBuilder('staff')
      .leftJoin('staff.user', 'user')
      .where('staff.store_id = :storeId', { storeId })
      .select([
        'staff.id',
        'staff.status',
        'staff.last_login_at',
        'staff.created_at',
        'user.id',
        'user.first_name',
        'user.last_name',
        'user.email',
        'user.avatar',
        'user.account_status',
      ]);

    if (query.status && query.status !== 'all') {
      qb.andWhere('staff.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere(
        '(LOWER(user.first_name) LIKE :search OR LOWER(user.last_name) LIKE :search OR LOWER(user.email) LIKE :search)',
        { search: `%${query.search.toLowerCase()}%` },
      );
    }

    qb.orderBy('staff.created_at', 'DESC');
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return buildPagination(data, total, page, limit);
  }

  async getStaff(staffId: string, storeId: string) {
    const staff = await this.staffRepo.findOne({
      where: { id: staffId, store_id: storeId },
      relations: ['user'],
      select: {
        id: true,
        status: true,
        permissions: true,
        last_login_at: true,
        created_at: true,
        user: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          avatar: true,
          account_status: true,
          phone_number: true,
          created_at: true,
        },
      },
    });
    if (!staff) throw new NotFoundException('Staff member not found');
    return staff;
  }

  async updateStaff(staffId: string, storeId: string, data: { first_name?: string; last_name?: string }) {
    const staff = await this.staffRepo.findOne({ where: { id: staffId, store_id: storeId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    if (data.first_name || data.last_name) {
      const update: Record<string, string> = {};
      if (data.first_name) update.first_name = data.first_name;
      if (data.last_name) update.last_name = data.last_name;
      await this.userRepo.update(staff.user_id, update);
    }

    await this.cache.clearPrefix('svc:staff');
    return { success: true };
  }

  async updateStaffPermissions(staffId: string, storeId: string, permissions: string[]) {
    const staff = await this.staffRepo.findOne({ where: { id: staffId, store_id: storeId } });
    if (!staff) throw new NotFoundException('Staff member not found');

    await this.staffRepo.update(staffId, { permissions });

    // Force re-auth to refresh JWT with new permissions
    const user = await this.userRepo.findOne({ where: { id: staff.user_id }, select: { id: true, token_version: true } });
    if (user) {
      await this.userRepo.update(user.id, { token_version: user.token_version + 1 });
    }

    await this.cache.clearPrefix('svc:staff');
    await this.cache.clearPrefix('svc:user');
    return { success: true };
  }

  async suspendStaff(staffId: string, storeId: string) {
    const staff = await this.staffRepo.findOne({ where: { id: staffId, store_id: storeId } });
    if (!staff) throw new NotFoundException('Staff member not found');
    await this.staffRepo.update(staffId, { status: 'suspended' });
    await this.cache.clearPrefix('svc:staff');
    return { success: true };
  }

  async unsuspendStaff(staffId: string, storeId: string) {
    const staff = await this.staffRepo.findOne({ where: { id: staffId, store_id: storeId } });
    if (!staff) throw new NotFoundException('Staff member not found');
    await this.staffRepo.update(staffId, { status: 'active' });
    await this.cache.clearPrefix('svc:staff');
    return { success: true };
  }

  async resetPassword(staffId: string, storeId: string, newPassword?: string) {
    const staff = await this.staffRepo.findOne({ where: { id: staffId, store_id: storeId }, relations: ['user'] });
    if (!staff) throw new NotFoundException('Staff member not found');

    const plainPassword = newPassword || this.generateTempPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, staff.user_id, {
        password: hashedPassword,
        must_change_password: !newPassword,
        token_version: staff.user.token_version + 1,
      });
    });

    if (!newPassword) {
      await this.inviteMail.sendPasswordResetEmail({
        email: staff.user.email,
        name: `${staff.user.first_name} ${staff.user.last_name}`,
        tempPassword: plainPassword,
      });
    }

    await this.cache.clearPrefix('svc:staff');
    return { success: true };
  }

  async removeStaff(staffId: string, storeId: string) {
    const staff = await this.staffRepo.findOne({ where: { id: staffId, store_id: storeId } });
    if (!staff) throw new NotFoundException('Staff member not found');
    await this.staffRepo.delete(staffId);
    await this.cache.clearPrefix('svc:staff');
    return { success: true };
  }
}
