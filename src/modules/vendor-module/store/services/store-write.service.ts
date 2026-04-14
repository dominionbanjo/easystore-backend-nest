import {
  Injectable,
  BadRequestException,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { UploadService } from 'src/common/services/upload.service';
import { PaystackService } from 'src/common/services/paystack.service';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { StoreAnalyticsService } from '../../store-analytics/services/store-analytics.service';
import { Store } from '../entities/store.entity';
import { CreateStoreDto } from '../dto/create-store.dto';
import { StoreHelperService } from './store-helper.service';
import { VerifiedBankInfo } from '../types/store-analytics.interface';
import { AdminNotifyMailService } from 'src/modules/shared-module/email/services/admin-notify-mail.service';
import { StoreWelcomeMailService } from 'src/modules/shared-module/email/services/store-welcome-mail.service';
import { ThemeSetting } from '../entities/theme-setting.entity';
import { UpdateThemeDto } from '../dto/update-theme.dto';

@Injectable()
export class StoreWriteService {
  constructor(
    private readonly cache: CacheService,
    private readonly upload: UploadService,
    private readonly paystack: PaystackService,
    private readonly helpers: StoreHelperService,
    private readonly adminNotifyMail: AdminNotifyMailService,
    private readonly storeWelcomeMail: StoreWelcomeMailService,

    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @Inject(forwardRef(() => StoreAnalyticsService))
    private readonly analyticsService: StoreAnalyticsService,

    @InjectRepository(ThemeSetting)
    private readonly themeSettingRepo: Repository<ThemeSetting>,
  ) {}

  async createStore(data: CreateStoreDto, manager?: EntityManager) {
    const { user_id, store_name, email } = data;

    const storeRepo = manager ? manager.getRepository(Store) : this.storeRepo;
    const userRepo = manager ? manager.getRepository(User) : this.userRepo;
    if (!user_id || !store_name || !email) {
      throw new BadRequestException('Missing required store fields');
    }

    const user = await userRepo.findOne({
      where: { id: user_id },
      select: ['id', 'first_name', 'last_name', 'email'],
    });

    if (!user) {
      throw new BadRequestException('Invalid user');
    }

    const existingStoreForUser = await storeRepo.findOne({
      where: { user_id },
      select: ['id'],
    });

    if (existingStoreForUser) {
      throw new BadRequestException(
        'User already owns a store. Only one store per user is allowed.',
      );
    }

    const existingStoreName = await storeRepo.exists({
      where: { store_name },
    });

    if (existingStoreName) {
      throw new BadRequestException('Store name already taken');
    }

    const slug = await this.helpers.generateUniqueSlug(store_name, manager);

    const store = storeRepo.create({
      ...data,
      id: uuidv4(),
      slug,
    });

    const saved = await storeRepo.save(store);

    // Update user account type to vendor (keep account_status active to allow dashboard access)
    await userRepo.update(user_id, {
      account_type: 'vendor',
    });

    // Notify Admin about new store
    this.adminNotifyMail
      .notifyNewStoreCreated({
        name: saved.store_name,
        ownerName: `${user.first_name} ${user.last_name}`,
        email: saved.email || user.email,
      })
      .catch((e) => console.error('Admin Store Notify Error:', e.message));

    // Send Welcome & Setup Guide to Vendor
    this.storeWelcomeMail
      .sendStoreWelcomeEmail({
        name: user.first_name,
        email: user.email,
        storeName: saved.store_name,
      })
      .catch((e) => console.error('Vendor Welcome Email Error:', e.message));

    await this.analyticsService.initializeAnalyticsForStore(saved.id, manager);

    await this.cache.clearPrefix('svc:store');
    await this.cache.clearPrefix('svc:store:list');

    return saved;
  }

  async updateStore(
    storeId: string,
    data: any,
    files?: {
      logo?: Express.Multer.File[];
      cover_image?: Express.Multer.File[];
    },
  ) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const allowed = [
      'store_name',
      'description',
      'category',
      'category_ids',
      'email',
      'phone_number',
      'social_links',
      'address_street',
      'address_city',
      'address_state',
      'address_country',
      'address_postal_code',
      'logo',
      'logo_public_id',
      'cover_image',
      'cover_image_public_id',
      'setup_stage',
    ];

    const filtered: Partial<Store> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        if (key === 'social_links' && typeof data[key] === 'string') {
          try {
            filtered[key] = JSON.parse(data[key]);
          } catch (e) {
            // skip invalid json
          }
        } else {
          filtered[key] = data[key];
        }
      }
    }

    // Handle file uploads ONLY if provided (backward compatibility)
    // If frontend sent a file, upload it. If frontend sent a string URL (in data), it's already in filtered.
    const logoFile = files?.logo?.[0];
    if (logoFile) {
      const up = await this.upload.uploadSingle(
        logoFile,
        'easystore/stores/logos',
      );

      if (!up) {
        throw new BadRequestException('Logo upload failed');
      }

      filtered.logo = up.url;
      filtered.logo_public_id = up.public_id;

      if (store.logo_public_id) {
        await this.upload.deleteSingle(store.logo_public_id);
      }
    }

    const coverFile = files?.cover_image?.[0];
    if (coverFile) {
      const up = await this.upload.uploadSingle(
        coverFile,
        'easystore/stores/covers',
      );

      if (!up) {
        throw new BadRequestException('Cover image upload failed');
      }

      filtered.cover_image = up.url;
      filtered.cover_image_public_id = up.public_id;

      if (store.cover_image_public_id) {
        await this.upload.deleteSingle(store.cover_image_public_id);
      }
    }

    if (
      filtered.store_name &&
      filtered.store_name.toLowerCase() !== store.store_name.toLowerCase()
    ) {
      const exists = await this.storeRepo.findOne({
        where: { store_name: filtered.store_name },
        select: ['id'],
      });

      if (exists && exists.id !== storeId) {
        throw new BadRequestException('Store name already in use');
      }

      filtered.slug = await this.helpers.generateUniqueSlug(
        filtered.store_name,
      );
    }

    filtered.updated_at = new Date();

    const updated = await this.storeRepo.save({
      ...store,
      ...filtered,
    });

    await this.cache.clearPrefix('svc:store');
    await this.cache.clearPrefix('svc:store:list');
    await this.cache.clearPrefix('svc:store:products');
    await this.cache.clearPrefix('svc:store:analytics');

    return updated;
  }

  async deleteStore(storeId: string) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    await this.storeRepo.delete(storeId);

    await this.cache.clearPrefix('svc:store');
    await this.cache.clearPrefix('svc:store:list');
    await this.cache.clearPrefix('svc:store:products');
    await this.cache.clearPrefix('svc:store:analytics');

    return { success: true, message: 'Store deleted successfully' };
  }

  async storeNameExists(name: string) {
    const existingStoreName = await this.storeRepo.findOne({
      where: { store_name: name },
      select: ['id'],
    });
    if (existingStoreName) {
      throw new BadRequestException('Store name not Available');
    }
    return { message: 'Store name Available' };
  }

  async registerBankAccount(
    storeId: string,
    bank_code: string,
    account_number: string,
    settlement_email?: string,
  ) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    if (
      store.last_bank_update &&
      Date.now() - store.last_bank_update.getTime() < THREE_DAYS_MS
    ) {
      throw new BadRequestException(
        'Bank account can only be updated once every 3 days.',
      );
    }

    const verified = await this.paystack.verifyBankAccount(
      account_number,
      bank_code,
    );
    if (!verified?.account_name)
      throw new BadRequestException('Bank verification failed');

    const recipient_code = await this.paystack.createTransferRecipient({
      name: verified.account_name,
      account_number,
      bank_code,
    });

    const subaccount_code = await this.paystack.createSubaccount({
      business_name: store.store_name,
      bank_code,
      account_number,
      percentage_charge: 1.5, // 1.5% platform fee deducted from vendor on each sale
    });

    const updated = await this.storeRepo.save({
      ...store,
      account_number,
      bank_code,
      bank_name: verified.bank_name || verified.account_name,
      recipient_code,
      paystack_subaccount_code: subaccount_code,
      settlement_email: settlement_email || store.settlement_email,
      payout_verified: true,
      setup_stage: store.setup_stage < 4 ? 4 : store.setup_stage,
      last_bank_update: new Date(),
      updated_at: new Date(),
    });

    await this.cache.clearPrefix('svc:store');
    await this.cache.clearPrefix('svc:store:list');

    return {
      success: true,
      message: 'Bank account registered',
      store: updated,
    };
  }

  async updateBankAccount(
    storeId: string,
    updates: {
      account_number?: string;
      bank_code?: string;
      settlement_email?: string;
    },
  ) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
    if (
      store.last_bank_update &&
      Date.now() - store.last_bank_update.getTime() < THREE_DAYS_MS
    ) {
      throw new BadRequestException(
        'Bank account can only be updated once every 3 days.',
      );
    }

    const { account_number, bank_code, settlement_email } = updates;

    let verified: VerifiedBankInfo | null = null;
    let recipient_code = store.recipient_code;
    let bank_name = store.bank_name;

    const detailsChanged =
      (account_number && account_number !== store.account_number) ||
      (bank_code && bank_code !== store.bank_code);

    if (detailsChanged) {
      const acct = account_number ?? store.account_number;
      const code = bank_code ?? store.bank_code;

      if (!acct || !code)
        throw new BadRequestException(
          'Bank account number and bank code are required',
        );

      verified = await this.paystack.verifyBankAccount(acct, code);
      if (!verified?.account_name)
        throw new BadRequestException('Bank verification failed');

      recipient_code = await this.paystack.createTransferRecipient({
        name: verified.account_name,
        account_number: acct,
        bank_code: code,
      });

      const subaccount_code = await this.paystack.createSubaccount({
        business_name: store.store_name,
        bank_code: code,
        account_number: acct,
        percentage_charge: 1.5, // 1.5% platform fee deducted from vendor on each sale
      });

      bank_name = verified.bank_name || verified.account_name;
      (updates as any).paystack_subaccount_code = subaccount_code;
    }

    const updated = await this.storeRepo.save({
      ...store,
      account_number: account_number ?? store.account_number,
      bank_code: bank_code ?? store.bank_code,
      bank_name,
      recipient_code,
      paystack_subaccount_code:
        (updates as any).paystack_subaccount_code ??
        store.paystack_subaccount_code,
      payout_verified: true,
      settlement_email: settlement_email ?? store.settlement_email,
      last_bank_update: new Date(),
      updated_at: new Date(),
    });

    await this.cache.clearPrefix('svc:store');
    await this.cache.clearPrefix('svc:store:list');

    return {
      success: true,
      message: verified
        ? 'Bank verified & updated'
        : 'Settlement email updated',
      store: updated,
      verified,
    };
  }

  async deleteBankAccount(storeId: string) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const updated = await this.storeRepo.save({
      ...store,
      account_number: null,
      bank_code: null,
      bank_name: null,
      recipient_code: null,
      settlement_email: null,
      payout_verified: false,
      updated_at: new Date(),
    });

    await this.cache.clearPrefix('svc:store');
    await this.cache.clearPrefix('svc:store:list');

    return { success: true, message: 'Bank account removed', store: updated };
  }

  /* ────────────────────────────────────────────────
     THEME / TEMPLATE WRITE METHODS
  ──────────────────────────────────────────────── */

  async updateStoreTheme(storeId: string, userId: string, dto: UpdateThemeDto) {
    const store = await this.storeRepo.findOne({
      where: { id: storeId, user_id: userId },
    });

    if (!store) {
      throw new NotFoundException(
        'Store not found or you do not have permission',
      );
    }

    let themeSetting = await this.themeSettingRepo.findOne({
      where: { store_id: storeId },
    });

    if (!themeSetting) {
      themeSetting = this.themeSettingRepo.create({
        store_id: storeId,
        template_id: dto.template_id,
        custom_config: dto.custom_config || {},
      });
    } else {
      themeSetting.template_id = dto.template_id;
      if (dto.custom_config !== undefined) {
        themeSetting.custom_config = dto.custom_config;
      }
    }

    await this.themeSettingRepo.save(themeSetting);

    return {
      message: 'Store theme updated successfully',
      data: themeSetting,
    };
  }
}
