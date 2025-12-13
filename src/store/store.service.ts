// src/store/store.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';

import { CacheService } from 'src/cache/cache.service';
import { UploadService } from 'src/common/services/upload.service';
import { PaystackService } from 'src/common/services/paystack.service';

import { PaginationQueryDto as PaginationDto } from 'src/common/dto/pagination.dto';
import { buildPagination as paginateWithRepo } from 'src/common/utils/response/pagination.util';

import { Store } from './entities/store.entity';
import { Product } from 'src/product/entities/product.entity';
import { User } from 'src/users/entities/user.entity';

// analytics interfaces - adapt to your project names
import {
  StoreAnalytics,
  MonthlySales,
  MonthlyOrder,
  MonthlyCustomer,
  StoreCustomer,
  VerifiedBankInfo,
} from './types/store-analytics.interface';
import { CreateStoreDto } from './dto/create-store.dto';

@Injectable()
export class StoreService {
  constructor(
    private readonly cache: CacheService,
    private readonly upload: UploadService,
    private readonly paystack: PaystackService,

    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // -----------------------------
  // Utility: generate slug
  // -----------------------------
  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true });
    let slug = base;
    let i = 1;
    while (await this.storeRepo.findOne({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  // -----------------------------
  // Create store
  // -----------------------------
  async createStore(data: CreateStoreDto) {
    const { user_id, store_name, email } = data;

    if (!user_id || !store_name || !email) {
      throw new BadRequestException('Missing required store fields');
    }

    const exists = await this.storeRepo.findOne({
      where: { store_name },
    });
    if (exists) throw new BadRequestException('Store name already taken');

    const slug = await this.generateUniqueSlug(store_name);

    const store = this.storeRepo.create({
      ...data,
      id: uuidv4(),
      slug,
      analytics: {
        sales: [],
        orders: [],
        customers: [],
      },
      customers: [],
    });

    const saved = await this.storeRepo.save(store);

    await this.cache.clearPrefix('svc:store');
    await this.cache.clearPrefix('svc:store:list');
    await this.cache.clearPrefix('svc:product');

    return saved;
  }

  // -----------------------------
  // Get categories for store (distinct)
  // -----------------------------
  async getStoreCategories(storeId: string): Promise<string[]> {
    if (!storeId) throw new BadRequestException('Store ID is required');

    const key = `svc:store:categories:${storeId}`;
    const cached = await this.cache.get<string[]>(key);
    if (cached) return cached;

    // Use QueryBuilder only here to get distinct categories — repository API doesn't provide distinct easily
    const raw = await this.productRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.category', 'category')
      .where('p.store_id = :storeId', { storeId })
      .andWhere('p.category IS NOT NULL')
      .getRawMany();

    const categories = raw.map((r) => r.category).filter(Boolean);

    await this.cache.set(key, categories);
    return categories;
  }

  // -----------------------------
  // Get store by id or slug
  // -----------------------------
  async getStore(identifier: string) {
    if (!identifier) throw new BadRequestException('Store identifier required');

    const key = `svc:store:one:${identifier}`;
    const cached = await this.cache.get<any>(key);
    if (cached) return cached;

    const isUUID = /^[0-9a-f]{8}-/.test(identifier);
    const store = isUUID
      ? await this.storeRepo.findOne({ where: { id: identifier } })
      : await this.storeRepo.findOne({ where: { slug: identifier } });

    if (!store) throw new NotFoundException('Store not found');

    const categories = await this.getStoreCategories(store.id);
    const result = { ...store, categories };

    await this.cache.set(key, result);
    return result;
  }

  // -----------------------------
  // Get all stores (paginated)
  // -----------------------------
  async getAllStores(pagination: PaginationDto = { page: 1, limit: 20 }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const key = `svc:store:list:${page}-${limit}`;
    const cached = await this.cache.get<any>(key);
    if (cached) return cached;

    // Fetch paginated stores
    const [rows, total] = await this.storeRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    // Build pagination response
    const result = paginateWithRepo(rows, total, page, limit);

    await this.cache.set(key, result);
    return result;
  }

  // -----------------------------
  // Admin: get all stores (full)
  async getAllStoresAdmin(pagination: PaginationDto = { page: 1, limit: 20 }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const key = `svc:store:admin-list:${page}-${limit}`;
    const cached = await this.cache.get<any>(key);
    if (cached) return cached;

    // Fetch paginated stores
    const [rows, total] = await this.storeRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    // Build pagination response using your helper
    const result = paginateWithRepo(rows, total, page, limit);

    await this.cache.set(key, result);
    return result;
  }

  // -----------------------------
  // Get store's products (paginated)
  // -----------------------------
  async getStoreProducts(
    identifier: string,
    pagination: PaginationDto = { page: 1, limit: 20 },
  ) {
    if (!identifier) throw new BadRequestException('Store identifier required');

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const key = `svc:store:products:${identifier}-${page}-${limit}`;
    const cached = await this.cache.get<any>(key);
    if (cached) return cached;

    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const store = isUUID
      ? await this.storeRepo.findOne({ where: { id: identifier } })
      : await this.storeRepo.findOne({ where: { slug: identifier } });

    if (!store) throw new NotFoundException('Store not found');

    const [rows, total] = await this.productRepo.findAndCount({
      where: { store_id: store.id },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    // 👇 Use your pagination util
    const paginationData = paginateWithRepo(rows, total, page, limit);

    // 👇 Match your desired return format (products + pagination)
    const result = {
      data: paginationData.data,
      pagination: paginationData.pagination,
    };

    await this.cache.set(key, result);
    return result;
  }

  // -----------------------------
  // Update store
  // -----------------------------
  async updateStore(storeId: string, data: any, files?: any) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const filtered: Partial<Store> = {};

    const allowed = [
      'store_name',
      'description',
      'category',
      'category_ids',
      'email',
      'phone_number',
      'website',
      'address',
    ];

    for (const key of allowed) {
      if (data[key] !== undefined) (filtered as any)[key] = data[key];
    }

    // Logo upload
    if (files?.logo) {
      const up = await this.upload.uploadSingle(
        files.logo,
        'easystore/stores/logos',
      );
      (filtered as any).logo = up?.url;
      (filtered as any).logo_public_id = up?.public_id;
      if (store.logo_public_id)
        await this.upload.deleteSingle(store.logo_public_id);
    }

    // Cover upload
    if (files?.cover_image) {
      const up = await this.upload.uploadSingle(
        files.cover_image,
        'easystore/stores/covers',
      );
      (filtered as any).cover_image = up?.url;
      (filtered as any).cover_image_public_id = up?.public_id;
      if (store.cover_image_public_id)
        await this.upload.deleteSingle(store.cover_image_public_id);
    }

    // Rename slug if store_name changed
    if (
      (filtered as any).store_name &&
      (filtered as any).store_name.toLowerCase() !==
        store.store_name.toLowerCase()
    ) {
      const exists = await this.storeRepo.findOne({
        where: { store_name: (filtered as any).store_name },
      });
      if (exists && exists.id !== storeId) {
        throw new BadRequestException('Store name already in use');
      }
      (filtered as any).slug = await this.generateUniqueSlug(
        (filtered as any).store_name,
      );
    }

    (filtered as any).updated_at = new Date();

    await this.storeRepo.update(storeId, filtered);

    // clear caches
    await this.cache.clearPrefix('svc:store');
    await this.cache.clearPrefix('svc:store:list');
    await this.cache.clearPrefix('svc:store:categories');
    await this.cache.clearPrefix('svc:store:products');
    await this.cache.clearPrefix('svc:store:analytics');

    const updated = await this.storeRepo.findOne({ where: { id: storeId } });
    return updated;
  }

  // -----------------------------
  // Delete store
  // -----------------------------
  async deleteStore(storeId: string) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    await this.storeRepo.delete(storeId);

    await this.cache.clearPrefix('svc:store');
    await this.cache.clearPrefix('svc:store:list');
    await this.cache.clearPrefix('svc:store:categories');
    await this.cache.clearPrefix('svc:store:products');
    await this.cache.clearPrefix('svc:store:analytics');

    return { success: true, message: 'Store deleted successfully' };
  }

  // -----------------------------
  // storeNameExists
  // -----------------------------
  async storeNameExists(name: string): Promise<boolean> {
    const existing = await this.storeRepo.findOne({
      where: { store_name: name.trim().toLowerCase() },
    });
    return !!existing;
  }

  // -----------------------------
  // updateStoreAnalytics
  // -----------------------------
  async updateStoreAnalytics(
    storeId: string,
    amount: number,
    customerId: string,
  ) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    const now = new Date();
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const today = now.toISOString();

    // Ensure JSONB defaults
    const analytics: StoreAnalytics = store.analytics ?? {
      sales: [],
      orders: [],
      customers: [],
    };
    const customers: StoreCustomer[] = store.customers ?? [];

    const findSales = (arr: MonthlySales[]) =>
      arr.find((r) => r.month === month && r.year === year);
    const findOrders = (arr: MonthlyOrder[]) =>
      arr.find((r) => r.month === month && r.year === year);
    const findCustomers = (arr: MonthlyCustomer[]) =>
      arr.find((r) => r.month === month && r.year === year);

    // -----------------------------
    // SALES
    // -----------------------------
    const salesRec = findSales(analytics.sales);
    if (salesRec) {
      salesRec.amount += amount;
    } else {
      analytics.sales.push({ month, year, amount });
    }

    // -----------------------------
    // ORDERS
    // -----------------------------
    const orderRec = findOrders(analytics.orders);
    if (orderRec) {
      orderRec.count += 1;
    } else {
      analytics.orders.push({ month, year, count: 1 });
    }

    // -----------------------------
    // MONTHLY UNIQUE CUSTOMERS
    // -----------------------------
    const custRec = findCustomers(analytics.customers);
    if (custRec) {
      if (!custRec.list.includes(customerId)) {
        custRec.list.push(customerId);
        custRec.count += 1;
      }
    } else {
      analytics.customers.push({
        month,
        year,
        count: 1,
        list: [customerId],
      });
    }

    // -----------------------------
    // CUSTOMER FULL RECORD
    // -----------------------------
    const user = await this.userRepo
      .findOne({ where: { id: customerId } })
      .catch(() => null);

    const fullName =
      `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim();
    const location =
      user?.address?.city ||
      user?.address?.state ||
      user?.address?.country ||
      null;

    const existing = customers.find((c) => c.id === customerId);

    if (existing) {
      existing.orders += 1;
      existing.spent += amount;
      existing.last_order_date = today; // string | null allowed
    } else {
      customers.push({
        id: customerId,
        name: fullName,
        email: user?.email ?? '',
        phone_number: user?.phone_number ?? null,
        location,
        orders: 1,
        spent: amount,
        rating: 0,
        last_order_date: today,
      });
    }

    // -----------------------------
    // APPLY ALL UPDATES USING SAVE()
    // -----------------------------
    store.analytics = analytics;
    store.customers = customers;
    store.total_revenue = (store.total_revenue || 0) + amount;
    store.total_orders = (store.total_orders || 0) + 1;
    store.active_customers = customers.length;
    store.updated_at = new Date();

    await this.storeRepo.save(store);

    // -----------------------------
    // CLEAR CACHE
    // -----------------------------
    await this.cache.clearPrefix('svc:store:analytics');
    await this.cache.clearPrefix('svc:store');
    await this.cache.clearPrefix('svc:store:list');

    return analytics;
  }

  // -----------------------------
  // getAnalytics
  // -----------------------------
  async getAnalytics(storeId: string, userId: string, role: string) {
    const key = `svc:store:analytics:${storeId}`;
    const cached = await this.cache.get<any>(key);
    if (cached) return cached;

    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

    if (role === 'vendor' && store.user_id !== userId) {
      throw new BadRequestException('Not allowed to view analytics');
    }

    const analytics: StoreAnalytics = store.analytics ?? {
      sales: [],
      orders: [],
      customers: [],
    };
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    const sorted = [...analytics.sales].sort(
      (a, b) =>
        a.year - b.year || months.indexOf(a.month) - months.indexOf(b.month),
    );

    const last = sorted[sorted.length - 2];
    const current = sorted[sorted.length - 1];

    const salesChange =
      last && current
        ? Number(
            (((current.amount - last.amount) / last.amount) * 100).toFixed(1),
          )
        : 0;

    const topProducts = await this.productRepo.find({
      where: { store_id: storeId },
      order: { total_sold: 'DESC' },
      take: 10,
    });

    const result = {
      summary: {
        total_sales: store.total_revenue || 0,
        orders: store.total_orders || 0,
        customers: store.active_customers || 0,
        conversion_rate:
          store.active_customers > 0
            ? Number(
                ((store.total_orders / store.active_customers) * 100).toFixed(
                  1,
                ),
              )
            : 0,
        sales_change: salesChange,
      },
      chart: {
        sales_trend: sorted,
        orders_trend: analytics.orders,
        customers_trend: analytics.customers,
      },
      top_products: topProducts,
      customers: store.customers ?? [],
      analytics,
    };

    await this.cache.set(key, result);
    return result;
  }

  // -----------------------------
  // registerBankAccount
  // -----------------------------
  async registerBankAccount(
    storeId: string,
    bank_code: string,
    account_number: string,
    settlement_email?: string,
  ) {
    const store = await this.storeRepo.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException('Store not found');

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

    const updated = await this.storeRepo.save({
      ...store,
      account_number,
      bank_code,
      bank_name: verified.bank_name || verified.account_name,
      recipient_code,
      settlement_email: settlement_email || store.settlement_email,
      payout_verified: true,
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

  // -----------------------------
  // updateBankAccount
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

      // 🚨 Prevent passing null into Paystack
      if (!acct || !code) {
        throw new BadRequestException(
          'Bank account number and bank code are required',
        );
      }

      // Verify
      verified = await this.paystack.verifyBankAccount(acct, code);
      if (!verified?.account_name)
        throw new BadRequestException('Bank verification failed');

      // Create new Paystack recipient
      recipient_code = await this.paystack.createTransferRecipient({
        name: verified.account_name,
        account_number: acct, // now 100% string
        bank_code: code, // now 100% string
      });

      bank_name = verified.bank_name || verified.account_name;
    }

    const updated = await this.storeRepo.save({
      ...store,
      account_number: account_number ?? store.account_number,
      bank_code: bank_code ?? store.bank_code,
      bank_name,
      recipient_code,
      payout_verified: true,
      settlement_email: settlement_email ?? store.settlement_email,
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

  // -----------------------------
  // deleteBankAccount
  // -----------------------------
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
}
