import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { StoreStaff } from 'src/modules/vendor-module/store/entities/store-staff.entity';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { Permission, ROLE_PERMISSIONS } from 'src/common/permissions/permissions';

@Injectable()
export class StaffService {
  constructor(
    @InjectRepository(StoreStaff)
    private readonly staffRepo: Repository<StoreStaff>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  private async resolveStoreId(userId: string): Promise<string> {
    const staff = await this.staffRepo.findOne({
      where: { user_id: userId, status: 'active' },
      select: { id: true, store_id: true },
    });
    if (!staff) throw new NotFoundException('Staff record not found or inactive');
    return staff.store_id;
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        avatar: true,
        created_at: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return { data: user };
  }

  async updateProfile(userId: string, data: { first_name?: string; last_name?: string; phone_number?: string }) {
    const update: Record<string, string> = {};
    if (data.first_name) update.first_name = data.first_name;
    if (data.last_name) update.last_name = data.last_name;
    if (data.phone_number) update.phone_number = data.phone_number;
    if (Object.keys(update).length === 0) return { success: true };
    await this.userRepo.update(userId, update);
    return { success: true };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, password: true, token_version: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.password || '');
    if (!isValid) throw new BadRequestException('Current password is incorrect');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userRepo.update(userId, {
      password: hashed,
      must_change_password: false,
      token_version: user.token_version + 1,
    });

    return { success: true };
  }

  async getEffectivePermissions(userId: string) {
    const rolePermissions = ROLE_PERMISSIONS['staff'] || [];
    const staff = await this.staffRepo.findOne({
      where: { user_id: userId, status: 'active' },
      select: { permissions: true },
    });
    const extra = staff?.permissions || [];
    const merged = [...new Set([...rolePermissions, ...extra])];
    return { permissions: merged };
  }

  async getStaffSummary(userId: string) {
    const storeId = await this.resolveStoreId(userId);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayOrders, todaySalesResult] = await Promise.all([
      this.orderRepo.count({
        where: {
          vendor_id: storeId,
          created_at: today as any,
          payment_method: In(['cash', 'transfer', 'pos', 'offline']),
        },
      }),
      this.orderRepo
        .createQueryBuilder('order')
        .select('COALESCE(SUM(order.total), 0)', 'total')
        .where('order.vendor_id = :storeId', { storeId })
        .andWhere('order.created_at >= :today', { today })
        .andWhere("order.payment_method IN ('cash', 'transfer', 'pos', 'offline')")
        .getRawOne(),
    ]);

    const [productCount] = await Promise.all([
      this.orderRepo
        .createQueryBuilder('order')
        .select('COUNT(DISTINCT order.id)', 'count')
        .where('order.vendor_id = :storeId', { storeId })
        .getRawOne(),
    ]);

    return {
      today_sales: Number(todaySalesResult?.total ?? 0),
      today_orders: todayOrders,
      total_products: Number(productCount?.count ?? 0),
      low_stock_count: 0, // Simplified; full product count would need Product repo
    };
  }
}
