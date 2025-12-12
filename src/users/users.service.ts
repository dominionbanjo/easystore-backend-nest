import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from './entities/user.entity';
import { Store } from 'src/store/entities/store.entity';
import { Product } from 'src/product/entities/product.entity';

import { UploadService } from 'src/common/services/upload.service';
import { PaystackService } from 'src/common/services/paystack.service'; // ✅ SDK service

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly uploadService: UploadService,

    private readonly paystackService: PaystackService, // ✅ Inject Paystack SDK service
  ) {}

  // ------------------------------------------------------------------
  // BASIC FINDERS
  // ------------------------------------------------------------------

  findByEmail(email: string) {
    return this.userRepo.findOne({ where: { email } });
  }

  findOne(opts: any) {
    return this.userRepo.findOne(opts);
  }

  findById(id: string) {
    return this.userRepo.findOne({ where: { id } });
  }

  // ------------------------------------------------------------------
  // CREATE USER
  // ------------------------------------------------------------------
  create(data: Partial<User>) {
    const entity = this.userRepo.create(data);
    return this.userRepo.save(entity);
  }

  // ------------------------------------------------------------------
  // UPDATE USER
  // ------------------------------------------------------------------
  update(id: string, data: Partial<User>) {
    return this.userRepo.update(id, data);
  }

  async getStores(userId: string) {
    return this.storeRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async getAllUsers(page = 1, limit = 25) {
    const [data, total] = await this.userRepo.findAndCount({
      select: [
        'id',
        'first_name',
        'last_name',
        'email',
        'phone_number',
        'account_type',
        'email_verified',
        'store_name',
        'created_at',
        'updated_at',
      ],
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      users: data,
      pagination: { page, limit, total },
    };
  }

  // ------------------------------------------------------------------
  // TOKEN VERSION (LOGOUT ALL)
  // ------------------------------------------------------------------
  async incrementTokenVersion(userId: string) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const newVersion = user.token_version + 1;

    await this.userRepo.update(userId, {
      token_version: newVersion,
      updated_at: new Date(),
    });

    return { token_version: newVersion };
  }

  // ------------------------------------------------------------------
  // USER PROFILE
  // ------------------------------------------------------------------
  async getProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    delete (user as any).password;
    return user;
  }

  async updateProfile(
    userId: string,
    data: Record<string, any>,
    file?: Express.Multer.File,
  ) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

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

    const allowed = [
      'first_name',
      'last_name',
      'phone_number',
      'store_name',
      'username',
      'current_sales_channel',
      'address',
      'avatar',
      'avatar_public_id',
    ];

    const filtered: Record<string, any> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) filtered[key] = data[key];
    }

    if (Object.keys(filtered).length === 0) {
      throw new BadRequestException('No valid fields to update');
    }

    filtered.updated_at = new Date();

    await this.userRepo.update(userId, filtered);

    return this.getProfile(userId);
  }

  // ------------------------------------------------------------------
  // BANK ACCOUNT REGISTER (PAYSTACK SDK)
  // ------------------------------------------------------------------
  async registerBankAccount(
    userId: string,
    bank_code: string,
    account_number: string,
    settlement_email?: string,
  ) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    // ✅ Using Paystack SDK instead of axios
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
      settlement_email: settlement_email || user.settlement_email,
      updated_at: new Date(),
    });

    return { message: 'Bank account registered successfully' };
  }

  // ------------------------------------------------------------------
  // UPDATE BANK ACCOUNT (PAYSTACK SDK)
  // ------------------------------------------------------------------
  async updateBankAccount(
    userId: string,
    updates: {
      account_number?: string;
      bank_code?: string;
      settlement_email?: string;
    },
  ) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const { account_number, bank_code, settlement_email } = updates;

    let newRecipient = user.recipient_code;
    let newBankName = user.bank_name;

    const changed =
      (account_number && account_number !== user.account_number) ||
      (bank_code && bank_code !== user.bank_code);

    if (changed) {
      const acct = account_number || user.account_number;
      const code = bank_code || user.bank_code;

      const verified = await this.paystackService.verifyBankAccount(
        acct!,
        code!,
      );

      newRecipient = await this.paystackService.createTransferRecipient({
        name: verified.account_name,
        account_number: acct!,
        bank_code: code!,
      });

      newBankName = verified.bank_name;
    }

    await this.userRepo.update(userId, {
      account_number: account_number ?? user.account_number,
      bank_code: bank_code ?? user.bank_code,
      bank_name: newBankName,
      recipient_code: newRecipient,
      settlement_email: settlement_email ?? user.settlement_email,
      updated_at: new Date(),
    });

    return { message: 'Bank account updated successfully' };
  }

  // ------------------------------------------------------------------
  // DELETE BANK ACCOUNT
  // ------------------------------------------------------------------
  async deleteBankAccount(userId: string) {
    const user = await this.findById(userId);
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
}
