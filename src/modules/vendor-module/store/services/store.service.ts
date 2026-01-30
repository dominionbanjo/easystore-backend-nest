import {
  Injectable,
  BadRequestException,
  NotFoundException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import { UploadService } from 'src/common/services/upload.service';
import { PaystackService } from 'src/common/services/paystack.service';
import { PaginationQueryDto as PaginationDto } from 'src/common/dto/pagination.dto';
import { ProductCategory } from 'src/modules/commerce-module/product-category/entities/product-category.entity';
import {
  Product,
  ProductStatus,
} from 'src/modules/commerce-module/product/entities/product.entity';
import { STORE_PRODUCTS_GROUPED_BY_CATEGORY_SQL } from 'src/modules/commerce-module/product/queries/products-grouped-by-category.store.sql';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { buildPagination } from 'src/utils/response/pagination.util';
import { StoreAnalyticsService } from '../../store-analytics/store-analytics.service';
import { Store } from '../entities/store.entity';
import { VerifiedBankInfo } from '../types/store-analytics.interface';
import { CreateStoreDto } from '../dto/create-store.dto';

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

    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,

    @Inject(forwardRef(() => StoreAnalyticsService))
    private readonly analyticsService: StoreAnalyticsService,
  ) {}

  /* ────────────────────────────────────────────────
     UTIL: UNIQUE SLUG
  ──────────────────────────────────────────────── */
  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name, { lower: true, strict: true });
    let slug = base;
    let i = 1;

    while (await this.storeRepo.findOne({ where: { slug } })) {
      slug = `${base}-${i++}`;
    }
    return slug;
  }

  async searchStores(
    q: string,
    pagination: PaginationDto = { page: 1, limit: 20 },
  ) {
    if (!q || !q.trim()) {
      throw new BadRequestException('Search query is required');
    }

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const cacheKey = `svc:store:search:${q}:${page}:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const qb = this.storeRepo
      .createQueryBuilder('store')
      .select([
        'store.id',
        'store.store_name',
        'store.category',
        'store.description',

        /* ADDRESS COLUMNS */
        'store.address_street',
        'store.address_city',
        'store.address_state',
        'store.address_country',
        'store.address_postal_code',

        'store.logo',
        'store.rating_average',
        'store.slug',
        'store.created_at',
        'store.user_id',
      ])
      // 🔢 Dynamic product count (vendor-based)
      .addSelect((subQ) => {
        return subQ
          .select('COUNT(product.id)')
          .from(Product, 'product')
          .where('product.vendor_id = store.user_id');
      }, 'total_products')
      .where('store.store_name ILIKE :q', { q: `%${q}%` })
      .orderBy('store.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const { raw, entities } = await qb.getRawAndEntities();

    const items = entities.map((store, index) => ({
      id: store.id,
      store_name: store.store_name,
      category: store.category,
      description: store.description,

      /* 🔁 RECONSTRUCT ADDRESS OBJECT */
      address: {
        street: store.address_street ?? null,
        city: store.address_city ?? null,
        state: store.address_state ?? null,
        country: store.address_country ?? null,
        postal_code: store.address_postal_code ?? null,
      },

      logo: store.logo,
      rating_average: store.rating_average,
      slug: store.slug,
      total_products: Number(raw[index].total_products),
    }));

    const result = buildPagination(items, items.length, page, limit);

    const response = {
      message: 'Store search results',
      data: result,
    };

    await this.cache.set(cacheKey, response);
    return response;
  }

  /* ────────────────────────────────────────────────
   VALIDATE VENDOR FOR ONLINE PAYMENTS
   (USED BY ORDER SERVICE)
──────────────────────────────────────────────── */
  async validateVendorForOnline(userId: string) {
    if (!userId) {
      throw new BadRequestException('Vendor user ID is required');
    }

    const store = await this.storeRepo.findOne({
      where: { user_id: userId },
      select: [
        'id',
        'user_id',
        'store_name',
        'payout_verified',
        'recipient_code',
      ],
    });

    if (!store) {
      throw new BadRequestException(`Vendor not found: ${userId}`);
    }

    if (!store.payout_verified || !store.recipient_code) {
      throw new BadRequestException(
        `Vendor ${store.store_name} cannot receive online payments`,
      );
    }

    return store;
  }

  /* ────────────────────────────────────────────────
   CREATE STORE (INTERNAL CORE)
──────────────────────────────────────────────── */
  async createStore(data: CreateStoreDto) {
    const { user_id, store_name, email } = data;

    // 1️⃣ Required fields
    if (!user_id || !store_name || !email) {
      throw new BadRequestException('Missing required store fields');
    }

    // 2️⃣ Ensure user exists (defensive check)
    const user = await this.userRepo.findOne({
      where: { id: user_id },
      select: ['id'],
    });

    if (!user) {
      throw new BadRequestException('Invalid user');
    }

    // 3️⃣ Enforce one store per user (business rule)
    const existingStoreForUser = await this.storeRepo.findOne({
      where: { user_id },
      select: ['id'],
    });

    if (existingStoreForUser) {
      throw new BadRequestException(
        'User already owns a store. Only one store per user is allowed.',
      );
    }

    // 4️⃣ Store name uniqueness (business rule)
    const existingStoreName = await this.storeRepo.exists({
      where: { store_name },
    });

    if (existingStoreName) {
      throw new BadRequestException('Store name already taken');
    }

    // 5️⃣ Generate unique slug
    const slug = await this.generateUniqueSlug(store_name);

    // 6️⃣ Create store
    const store = this.storeRepo.create({
      ...data,
      id: uuidv4(),
      slug,
    });

    const saved = await this.storeRepo.save(store);
    await this.analyticsService.initializeAnalyticsForStore(saved.id);

    // 7️⃣ Clear caches
    await this.cache.clearPrefix('svc:store');
    await this.cache.clearPrefix('svc:store:list');

    return saved;
  }

  /* ────────────────────────────────────────────────
     GET STORE (ID OR SLUG)
  ──────────────────────────────────────────────── */
  async getStore(
    identifier: string,
    options?: {
      includeProducts?: boolean;
      includeCategories?: boolean;
      productPage?: number;
      productLimit?: number;
    },
  ) {
    if (!identifier) {
      throw new BadRequestException('Store identifier required');
    }

    const includeProducts = options?.includeProducts ?? false;
    const includeCategories = options?.includeCategories ?? true;

    const page = options?.productPage ?? 1;
    const limit = options?.productLimit ?? 20;

    const cacheKey = `svc:store:one:${identifier}:products:${includeProducts}:p:${page}:l:${limit}:categories:${includeCategories}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const store = await this.storeRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    /* ───────────── PRODUCTS (PAGINATED) ───────────── */

    let productsResult: ReturnType<typeof buildPagination> | null = null;

    if (includeProducts) {
      const [products, total] = await this.productRepo
        .createQueryBuilder('product')
        .leftJoin('product.category_ref', 'category')
        .select([
          'product.id',
          'product.name',
          'product.slug',
          'product.price',
          'product.image',
          'product.rating_average',
          'product.stock',
          'product.created_at',

          'category.id',
          'category.name',
          'category.slug',
        ])
        .where('product.store_id = :storeId', { storeId: store.id })
        .orderBy('product.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      const items = products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        image: p.image?.url ?? null,
        rating_average: Number(p.rating_average),
        stock: p.stock,
      }));

      productsResult = buildPagination(items, total, page, limit);
    }

    /* ───────────── CATEGORIES (DERIVED) ───────────── */

    let categories: ProductCategory[] = [];

    if (includeCategories) {
      categories = await this.categoryRepo
        .createQueryBuilder('category')
        .innerJoin('category.products', 'product')
        .where('product.store_id = :storeId', { storeId: store.id })
        .select(['category.id', 'category.name', 'category.slug'])
        .distinct(true)
        .getMany();
    }

    const response = {
      message: 'Store retrieved successfully',
      store,
      products: productsResult, // 👈 paginated
      categories,
    };

    await this.cache.set(cacheKey, response);
    return response;
  }

  /* ────────────────────────────────────────────────
   GET STORE BY USER (INTERNAL / GUARDED)
──────────────────────────────────────────────── */
  async getStoreByUser(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const cacheKey = `svc:store:user:${userId}`;
    const cached = await this.cache.get<Store>(cacheKey);
    if (cached) return cached;

    const store = await this.storeRepo.findOne({
      where: { user_id: userId },
    });

    if (!store) {
      throw new NotFoundException('Store not found for this user');
    }

    await this.cache.set(cacheKey, store);
    return store;
  }

  /* ────────────────────────────────────────────────
     GET ALL STORES (PUBLIC)
  ──────────────────────────────────────────────── */
  async getAllStores(pagination: PaginationDto = { page: 1, limit: 20 }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const cacheKey = `svc:store:list:${page}-${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const qb = this.storeRepo
      .createQueryBuilder('store')
      .select([
        'store.id',
        'store.store_name',
        'store.category',
        'store.description',

        /* ADDRESS COLUMNS */
        'store.address_street',
        'store.address_city',
        'store.address_state',
        'store.address_country',
        'store.address_postal_code',

        'store.logo',
        'store.rating_average',
        'store.slug',
        'store.created_at',
        'store.user_id',
      ])
      /* 🔢 DYNAMIC TOTAL PRODUCTS (SOURCE OF TRUTH) */
      .addSelect((subQ) => {
        return subQ
          .select('COUNT(product.id)')
          .from(Product, 'product')
          .where('product.vendor_id = store.user_id');
      }, 'total_products')
      .orderBy('store.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const { raw, entities } = await qb.getRawAndEntities();

    const items = entities.map((store, index) => ({
      id: store.id,
      store_name: store.store_name,
      category: store.category,
      description: store.description,

      /* 🔁 RECONSTRUCT ADDRESS OBJECT */
      address: {
        street: store.address_street ?? null,
        city: store.address_city ?? null,
        state: store.address_state ?? null,
        country: store.address_country ?? null,
        postal_code: store.address_postal_code ?? null,
      },

      logo: store.logo,
      rating_average: store.rating_average,
      slug: store.slug,
      total_products: Number(raw[index].total_products),
    }));

    const result = buildPagination(items, items.length, page, limit);

    const response = {
      message: 'Stores retrieved successfully',
      data: result,
    };

    await this.cache.set(cacheKey, response);
    return response;
  }

  /* ────────────────────────────────────────────────
     GET ALL STORES (ADMIN)
  ──────────────────────────────────────────────── */
  async getAllStoresAdmin(pagination: PaginationDto = { page: 1, limit: 20 }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const cacheKey = `svc:store:admin-list:${page}-${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const qb = this.storeRepo
      .createQueryBuilder('store')
      .addSelect((subQ) => {
        return subQ
          .select('COUNT(product.id)')
          .from(Product, 'product')
          .where('product.vendor_id = store.user_id');
      }, 'total_products')
      .orderBy('store.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const { raw, entities } = await qb.getRawAndEntities();

    const items = entities.map((store, index) => ({
      ...store,
      total_products: Number(raw[index].total_products),
    }));

    const result = buildPagination(items, items.length, page, limit);

    const response = {
      message: 'Stores retrieved successfully',
      data: result,
    };

    await this.cache.set(cacheKey, response);
    return response;
  }

  /* ────────────────────────────────────────────────
     GET STORE PRODUCTS
  ──────────────────────────────────────────────── */

  async getTotalProductsForStore(storeId: string): Promise<number> {
    const store = await this.storeRepo.findOne({
      where: { id: storeId },
      select: ['user_id'],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return this.productRepo.count({
      where: { vendor_id: store.user_id },
    });
  }

  async getStoreProducts(
    identifier: string,
    pagination: PaginationDto = { page: 1, limit: 20 },
  ) {
    if (!identifier) {
      throw new BadRequestException('Store identifier required');
    }

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const cacheKey = `svc:store:products:${identifier}:page:${page}:limit:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const store = await this.storeRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      select: ['id'],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const [products, total] = await this.productRepo
      .createQueryBuilder('product')
      .leftJoin('product.category_ref', 'category')
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.price',
        'product.image',
        'product.rating_average',
        'product.stock',
        'product.created_at',

        'category.id',
        'category.name',
        'category.slug',
      ])
      .where('product.store_id = :storeId', { storeId: store.id })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })
      .orderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      image: p.image?.url ?? null,
      rating_average: Number(p.rating_average),
      stock: p.stock,
    }));

    const data = buildPagination(items, total, page, limit);

    const response = {
      message: 'Store products retrieved successfully',
      data,
    };

    await this.cache.set(cacheKey, response);
    return response;
  }

  async getStoreProductsByCategory(
    identifier: string,
    categoryId: string,
    pagination: PaginationDto = { page: 1, limit: 20 },
  ) {
    if (!identifier) {
      throw new BadRequestException('Store identifier required');
    }

    if (!categoryId) {
      throw new BadRequestException('Category ID is required');
    }

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const cacheKey = `svc:store:category-products:${identifier}:${categoryId}:p:${page}:l:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    /* ───────────── RESOLVE STORE ───────────── */
    const store = await this.storeRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      select: ['id', 'store_name'],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    /* ───────────── VERIFY CATEGORY ───────────── */
    const categoryExists = await this.categoryRepo.exist({
      where: { id: categoryId },
    });

    if (!categoryExists) {
      throw new NotFoundException('Category not found');
    }

    /* ───────────── FETCH PRODUCTS ───────────── */
    const [products, total] = await this.productRepo
      .createQueryBuilder('product')
      .leftJoin('product.category_ref', 'category')
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.price',
        'product.image',
        'product.rating_average',
        'product.stock',
        'product.created_at',

        'category.id',
        'category.name',
        'category.slug',
      ])
      .where('product.store_id = :storeId', { storeId: store.id })
      .andWhere('product.category_id = :categoryId', { categoryId })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })
      .orderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      image: p.image?.url ?? null,
      rating_average: Number(p.rating_average),
      stock: p.stock,
    }));

    const data = buildPagination(items, total, page, limit);

    const response = {
      message: 'Store category products retrieved successfully',
      store: {
        id: store.id,
        store_name: store.store_name,
      },
      category_id: categoryId,
      data,
    };

    await this.cache.set(cacheKey, response);
    return response;
  }

  async getStoreProductsGroupedByCategory(
    identifier: string,
    pagination: PaginationDto = { limit: 10 },
  ) {
    if (!identifier) {
      throw new BadRequestException('Store identifier required');
    }

    const perCategoryLimit = pagination.limit ?? 10;

    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    // 1️⃣ Resolve store id only
    const store = await this.storeRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      select: ['id', 'store_name'],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    // 2️⃣ Run optimized store-scoped query
    const rows = await this.productRepo.query(
      STORE_PRODUCTS_GROUPED_BY_CATEGORY_SQL,
      [store.id, perCategoryLimit],
    );

    // 3️⃣ Fetch parent categories (cheap)
    const parents = await this.categoryRepo.find({
      where: { parent_id: IsNull() },
      select: ['id', 'name', 'slug'],
      order: { created_at: 'ASC' },
    });

    // 4️⃣ Group products by parent category
    const grouped = new Map<string, any[]>();

    for (const row of rows) {
      if (!grouped.has(row.parent_category_id)) {
        grouped.set(row.parent_category_id, []);
      }

      grouped.get(row.parent_category_id)!.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        price: row.price,
        discount_price: row.discount_price,
        stock: row.stock,
        rating_average: row.rating_average,
      });
    }

    // 5️⃣ Attach to categories (same format as global)
    const data = parents.map((parent) => ({
      id: parent.id,
      name: parent.name,
      slug: parent.slug,
      products: grouped.get(parent.id) ?? [],
    }));

    return {
      message: 'Store products retrieved successfully',
      store: {
        id: store.id,
        store_name: store.store_name,
      },
      data,
    };
  }

  /* ────────────────────────────────────────────────
     UPDATE STORE
  ──────────────────────────────────────────────── */
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
      'website',
      'address',
    ];

    const filtered: Partial<Store> = {};
    for (const key of allowed) {
      if (data[key] !== undefined) {
        filtered[key] = data[key];
      }
    }

    /* ───────────────── FILE UPLOADS (SAFE) ───────────────── */

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

    /* ───────────────── STORE NAME CHANGE ───────────────── */

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

      filtered.slug = await this.generateUniqueSlug(filtered.store_name);
    }

    /* ───────────────── SAVE ───────────────── */

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

  /* ────────────────────────────────────────────────
     DELETE STORE
  ──────────────────────────────────────────────── */
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

  /* ────────────────────────────────────────────────
     STORE NAME EXISTS
  ──────────────────────────────────────────────── */
  async storeNameExists(name: string) {
    console.log(name);
    const existingStoreName = await this.storeRepo.findOne({
      where: { store_name: name },
      select: ['id'],
    });
    if (existingStoreName) {
      throw new BadRequestException('Store name not Available');
    }
    return { message: 'Store name Available' };
  }

  /* ────────────────────────────────────────────────
     BANK ACCOUNT MANAGEMENT
  ──────────────────────────────────────────────── */
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
   STORE OWNERSHIP CHECK (USED BY GUARDS)
──────────────────────────────────────────────── */
  async isStoreOwner(storeId: string, userId: string): Promise<boolean> {
    if (!storeId || !userId) {
      throw new BadRequestException('Store ID and User ID are required');
    }

    const store = await this.storeRepo.findOne({
      where: { id: storeId },
      select: ['id', 'user_id'],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    return store.user_id === userId;
  }
}
