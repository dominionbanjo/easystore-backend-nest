import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UploadService } from 'src/common/services/upload.service';
import { PaystackService } from 'src/common/services/paystack.service';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { StoreStaff } from 'src/modules/vendor-module/store/entities/store-staff.entity';
import { buildPagination } from 'src/utils/response/pagination.util';
import { sanitizeUser } from 'src/utils/response/sanitizeUser';
import { EntityManager } from 'typeorm';
import { UserAddress } from './entities/user-address.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(UserAddress)
    private readonly addressRepo: Repository<UserAddress>,

    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,

    @InjectRepository(StoreStaff)
    private readonly storeStaffRepo: Repository<StoreStaff>,

    private readonly uploadService: UploadService,
    private readonly paystackService: PaystackService,
  ) {}

  findByEmail(email: string) {
    return this.userRepo.findOne({
      where: { email },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        username: true,
        phone_number: true,
        avatar: true,
        account_type: true,
        account_status: true,
        email_verified: true,
        token_version: true,
        created_at: true,
      },
    });
  }

  async findByEmailWithPassword(email: string) {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findByEmailWithToken(email: string) {
    return this.userRepo
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .getOne();
  }

  async existsByUsername(username: string): Promise<boolean> {
    return this.userRepo.exist({
      where: { username },
    });
  }

  // findOne(opts: any) {
  //   return this.userRepo.findOne(opts);
  // }

  findById(id: string) {
    return this.userRepo.findOne({
      where: { id },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        username: true,
        phone_number: true,
        avatar: true,
        account_type: true,
        account_status: true,
        email_verified: true,
        token_version: true,
        created_at: true,
      },
    });
  }
  findByGoogleId(googleId: string) {
    return this.userRepo.findOne({
      where: { google_id: googleId },
    });
  }

  /* ────────────────────────────────────────────────
     CREATE USER
  ──────────────────────────────────────────────── */
  create(data: Partial<User>, manager?: EntityManager) {
    const repo = manager ? manager.getRepository(User) : this.userRepo;
    const entity = repo.create(data);
    return repo.save(entity);
  }

  /* ────────────────────────────────────────────────
     UPDATE USER (RAW)
  ──────────────────────────────────────────────── */
  update(id: string, data: Partial<User>) {
    return this.userRepo.update(id, data);
  }

  /* ────────────────────────────────────────────────
     GET USER STORES
  ──────────────────────────────────────────────── */
  async getStores(userId: string) {
    return this.storeRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  /* ────────────────────────────────────────────────
     GET ALL USERS (STANDARD PAGINATION)
  ──────────────────────────────────────────────── */

  async getAllUsers(
    pagination: { page?: number; limit?: number } = { page: 1, limit: 25 },
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 25;

    const [rows, total] = await this.userRepo.findAndCount({
      select: [
        'id',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'account_type',
        'email_verified',
        'created_at',
        'updated_at',
      ],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    const result = buildPagination(rows, total, page, limit);

    return {
      message: 'Users retrieved successfully',
      data: result,
    };
  }

  /* ────────────────────────────────────────────────
     TOKEN VERSION (LOGOUT ALL)
  ──────────────────────────────────────────────── */
  async incrementTokenVersion(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const newVersion = user.token_version + 1;

    await this.userRepo.update(userId, {
      token_version: newVersion,
      updated_at: new Date(),
    });

    return { token_version: newVersion };
  }

  async getForJwtValidation(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'account_type', 'token_version', 'account_status'],
      relations: ['store'],
    });

    if (!user) return null;

    let store_id: string | null = user.store?.id ?? null;

    if (!store_id && user.account_type === 'staff') {
      const staff = await this.storeStaffRepo.findOne({
        where: { user_id: userId, status: 'active' },
        select: { store_id: true },
      });
      store_id = staff?.store_id ?? null;
    }

    return {
      id: user.id,
      account_type: user.account_type,
      account_status: user.account_status,
      token_version: user.token_version,
      store_id,
    };
  }

  /* ────────────────────────────────────────────────
     USER PROFILE
  ──────────────────────────────────────────────── */
  async getProfile(userId: string) {
    const user2 = await this.userRepo.findOne({
      where: { id: userId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        username: true,
        avatar: true,
        account_type: true,
        bank_code: true,
        account_number: true,
        payout_verified: true,
        addresses: {
          id: true,
          street: true,
          city: true,
          state: true,
          country: true,
          postal_code: true,
        },
      },
      relations: ['addresses'],
    });
    if (!user2) throw new NotFoundException('User not found');

    delete (user2 as any).password;
    
    // Maintain old address JSON shape for backwards compatibility if needed on frontend,
    // pulling from the default address.
    const defaultAddress = user2.addresses?.find((a) => a.is_default) || user2.addresses?.[0];
    if (defaultAddress && !user2.address) {
      user2.address = {
        street: defaultAddress.street,
        city: defaultAddress.city,
        state: defaultAddress.state,
        country: defaultAddress.country,
        postal_code: defaultAddress.postal_code,
      };
    }

    const user = sanitizeUser(user2);

    return { message: 'Profile retrieved successfully', user };
  }

  async updateProfile(
    userId: string,
    data: Record<string, any>,
    file?: Express.Multer.File,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // ---------------------------
    // Avatar upload
    // ---------------------------
    if (file) {
      const uploaded = await this.uploadService.uploadSingle(
        file,
        'easystore/users',
      );

      if (uploaded) {
        data.avatar = uploaded.url;
        data.avatar_public_id = uploaded.public_id;

        if (user.avatar_public_id) {
          await this.uploadService.deleteSingle(user.avatar_public_id);
        }
      }
    }

    // ---------------------------
    // Address (migrate to UserAddress Entity)
    // ---------------------------
    if (data.address && typeof data.address === 'object') {
      // For backwards compatibility and migration, if they send address object, 
      // we save it as a new UserAddress marked as default if none exist, or update the existing default
      const existingAddresses = await this.addressRepo.find({ where: { user_id: userId } });
      const defaultAddress = existingAddresses.find(a => a.is_default) || existingAddresses[0];

      if (defaultAddress) {
        Object.assign(defaultAddress, data.address);
        await this.addressRepo.save(defaultAddress);
      } else {
        const newAddress = this.addressRepo.create({
          user_id: userId,
          is_default: true,
          street: data.address.street || '',
          city: data.address.city || '',
          state: data.address.state || '',
          country: data.address.country || '',
          postal_code: data.address.postal_code || '',
        });
        await this.addressRepo.save(newAddress);
      }
      
      // Also update the legacy JSON object just in case standard payloads expect it statically until fully deprecated
      user.address = {
        ...(user.address ?? {}),
        ...data.address,
      };
    }

    // ---------------------------
    // Other allowed fields
    // ---------------------------
    const allowed = [
      'first_name',
      'last_name',
      'phone_number',
      'store_name',
      'username',
      'current_sales_channel',
      'avatar',
      'avatar_public_id',
    ];

    for (const key of allowed) {
      if (data[key] !== undefined) {
        (user as any)[key] = data[key];
      }
    }

    if (!data.address && !allowed.some((key) => data[key] !== undefined)) {
      throw new BadRequestException('No valid fields to update');
    }

    user.updated_at = new Date();

    await this.userRepo.save(user);
    return { success: true };
  }

  /* ────────────────────────────────────────────────
     BANK ACCOUNT (PAYSTACK)
  ──────────────────────────────────────────────── */
  async registerBankAccount(
    userId: string,
    bank_code: string,
    account_number: string,
    settlement_email?: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // 3-Day Restriction Check
    if (user.last_bank_update) {
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
      const timeSinceUpdate = Date.now() - user.last_bank_update.getTime();
      
      if (timeSinceUpdate < THREE_DAYS_MS) {
        throw new BadRequestException('You can only change your bank account details once every 3 days for security purposes. Please wait before updating your payout bank details.');
      }
    }

    const verified = await this.paystackService.verifyBankAccount(
      account_number,
      bank_code,
    );

    const recipient_code = await this.paystackService.createTransferRecipient({
      name: verified.account_name,
      account_number,
      bank_code,
    });

    await this.userRepo.update(userId, {
      account_number,
      bank_code,
      bank_name: verified.bank_name,
      recipient_code,
      payout_verified: true,
      last_bank_update: new Date(),
      settlement_email: settlement_email || user.settlement_email,
      updated_at: new Date(),
    });

    return { message: 'Bank account registered successfully' };
  }

  async deleteBankAccount(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.userRepo.update(userId, {
      account_number: null,
      bank_code: null,
      bank_name: null,
      recipient_code: null,
      payout_verified: false,
      settlement_email: null,
      updated_at: new Date(),
    });

    return { message: 'Bank account removed successfully' };
  }

  async deleteUser(userId: string) {
    await this.userRepo.delete({ id: userId });
  }

  /* ────────────────────────────────────────────────
     ADDRESS MANAGEMENT
  ──────────────────────────────────────────────── */
  async addUserAddress(userId: string, data: Partial<UserAddress>) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const addressCount = await this.addressRepo.count({ where: { user_id: userId } });
    
    // If it's their first address or they set it to default, ensure it represents the default
    const isNewDefault = data.is_default || addressCount === 0;

    if (isNewDefault) {
      await this.addressRepo.update({ user_id: userId }, { is_default: false });
    }

    const newAddress = this.addressRepo.create({
      ...data,
      user_id: userId,
      is_default: isNewDefault,
    });

    const saved = await this.addressRepo.save(newAddress);
    return { success: true, id: saved.id, message: 'Address added successfully' };
  }

  async updateUserAddress(userId: string, addressId: string, data: Partial<UserAddress>) {
    const address = await this.addressRepo.findOne({ where: { id: addressId, user_id: userId } });
    if (!address) throw new NotFoundException('Address not found');

    if (data.is_default) {
      await this.addressRepo.update({ user_id: userId }, { is_default: false });
    }

    Object.assign(address, data);
    const updated = await this.addressRepo.save(address);

    return { success: true, id: updated.id, message: 'Address updated successfully' };
  }

  async deleteUserAddress(userId: string, addressId: string) {
    const result = await this.addressRepo.delete({ id: addressId, user_id: userId });
    if (result.affected === 0) {
      throw new NotFoundException('Address not found');
    }
    return { message: 'Address deleted successfully' };
  }
}
