import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { PaginationQueryDto as PaginationDto } from 'src/common/dto/pagination.dto';
import { ProductCategory } from 'src/modules/commerce-module/product-category/entities/product-category.entity';
import {
  Product,
  ProductStatus,
} from 'src/modules/commerce-module/product/entities/product.entity';
import { Wishlist } from 'src/modules/commerce-module/wishlist/entities/wishlist.entity';
import { StoreTemplate } from '../entities/store-template.entity';
import { ThemeSetting } from '../entities/theme-setting.entity';
import { STORE_PRODUCTS_GROUPED_BY_CATEGORY_SQL } from 'src/modules/commerce-module/product/queries/products-grouped-by-category.store.sql';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import {
  addProductCardSelects,
  mapToProductCardData,
} from 'src/modules/commerce-module/product/utils/product-card.util';
import {
  mapToPublicStore,
  mapToOwnerStore,
} from '../utils/store-sanitizer.util';
import { buildPagination } from 'src/utils/response/pagination.util';
import { Store } from '../entities/store.entity';
import { StoreHelperService } from './store-helper.service';

@Injectable()
export class StoreReadService {
  constructor(
    private readonly cache: CacheService,
    private readonly helpers: StoreHelperService,

    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
    @InjectRepository(Wishlist)
    private readonly wishlistRepo: Repository<Wishlist>,

    @InjectRepository(StoreTemplate)
    private readonly templateRepo: Repository<StoreTemplate>,

    @InjectRepository(ThemeSetting)
    private readonly themeSettingRepo: Repository<ThemeSetting>,
  ) {}

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
      .leftJoin(Product, 'product', 'product.vendor_id = store.user_id')
      .addSelect('COUNT(product.id)', 'total_products')
      .groupBy('store.id')
      .addGroupBy('user.id')
      .where('store.store_name ILIKE :q', { q: `%${q}%` })
      .innerJoin(
        'users',
        'user',
        'user.id = store.user_id AND user.account_status = :userStatus',
        { userStatus: 'active' },
      )
      .andWhere('store.status = :storeStatus', { storeStatus: 'active' });

    if (pagination.state) {
      qb.andWhere('store.address_state = :state', { state: pagination.state });
    }

    qb.orderBy('store.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const { raw, entities } = await qb.getRawAndEntities();

    const items = entities.map((store, index) => ({
      id: store.id,
      store_name: store.store_name,
      category: store.category,
      description: store.description,
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

  async getStore(
    identifier: string,
    options?: {
      includeProducts?: boolean;
      includeCategories?: boolean;
      productPage?: number;
      productLimit?: number;
      userId?: string;
    },
  ) {
    if (!identifier) {
      throw new BadRequestException('Store identifier required');
    }

    const includeProducts = options?.includeProducts ?? false;
    const includeCategories = options?.includeCategories ?? true;
    const userId = options?.userId;

    const page = options?.productPage ?? 1;
    const limit = options?.productLimit ?? 20;

    const cacheKey = `svc:store:one:${identifier}:products:${includeProducts}:p:${page}:l:${limit}:categories:${includeCategories}:u:${userId || 'anon'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const store = await this.storeRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      relations: ['user', 'theme_setting', 'theme_setting.template'],
    });

    // Strictly require store AND user account to both be active for public access.
    // No owner bypass — pending/restricted stores are invisible to everyone on this route.
    if (
      !store ||
      store.status !== 'active' ||
      store.user?.account_status !== 'active'
    ) {
      throw new NotFoundException('Store not found or is inactive');
    }

    const totalProductsCount = await this.productRepo.count({
      where: { vendor_id: store.user_id },
    });

    let productsResult: ReturnType<typeof buildPagination> | null = null;

    if (includeProducts) {
      const qb = addProductCardSelects(
        this.productRepo.createQueryBuilder('product'),
      )
        .where('product.store_id = :storeId', { storeId: store.id })
        .andWhere('product.status = :status', {
          status: ProductStatus.ACTIVE,
        });

      const [products, total] = await qb
        .orderBy('product.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount();

      // 🔗 WISHLIST CHECK
      let wishlistedIds = new Set<string>();
      if (userId && products.length > 0) {
        const wishlisted = await this.wishlistRepo.find({
          where: {
            user_id: userId,
            product_id: In(products.map((p) => p.id)),
          },
          select: ['product_id'],
        });
        wishlistedIds = new Set(wishlisted.map((w) => w.product_id));
      }

      const items = products.map((p) =>
        mapToProductCardData(p, {
          wishlistSet: wishlistedIds,
          extra: {
            store_name: store.store_name,
            store_slug: store.slug,
          },
        }),
      );

      const enriched = await this.helpers.resolveColorsForList(items);
      productsResult = buildPagination(enriched, total, page, limit);
    }

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

    let themeData: any = null;
    if (store.theme_setting && store.theme_setting.template) {
      themeData = {
        template: store.theme_setting.template,
        custom_config: store.theme_setting.custom_config,
      };
    } else {
      const defaultTemplate = await this.templateRepo.findOne({
        where: { name: 'Default' },
      });
      themeData = {
        template: defaultTemplate,
        custom_config: {},
      };
    }

    const response = {
      message: 'Store retrieved successfully',
      store: {
        ...mapToPublicStore(store, totalProductsCount),
        theme: themeData,
      },
      products: productsResult,
      categories,
    };

    await this.cache.set(cacheKey, response);
    return response;
  }

  async getStoreByUser(userId: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const cacheKey = `svc:store:user:${userId}`;
    const cached = await this.cache.get<Store>(cacheKey);
    if (cached) return cached;

    const store = await this.storeRepo.findOne({
      where: { user_id: userId },
      relations: ['user'],
    });

    if (!store) {
      throw new NotFoundException('Store not found for this user');
    }

    await this.cache.set(cacheKey, store);
    return store;
  }

  async getAllStores(pagination: PaginationDto = { page: 1, limit: 20 }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const cacheKey = `svc:store:list:${page}-${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const qb = this.storeRepo
      .createQueryBuilder('store')
      .innerJoin(
        'users',
        'user',
        'user.id = store.user_id AND user.account_status = :userStatus',
        { userStatus: 'active' },
      )
      .andWhere('store.status = :storeStatus', { storeStatus: 'active' })
      .select([
        'store.id',
        'store.store_name',
        'store.category',
        'store.description',
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
      .leftJoin(Product, 'product', 'product.vendor_id = store.user_id')
      .addSelect('COUNT(product.id)', 'total_products')
      .groupBy('store.id')
      .addGroupBy('user.id');

    if (pagination.state) {
      qb.andWhere('store.address_state = :state', { state: pagination.state });
    }

    qb.orderBy('store.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const { raw, entities } = await qb.getRawAndEntities();

    const items = entities.map((store, index) => ({
      id: store.id,
      store_name: store.store_name,
      category: store.category,
      description: store.description,
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

  async getAllStoresAdmin(pagination: PaginationDto = { page: 1, limit: 20 }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const cacheKey = `svc:store:admin-list:${page}-${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const qb = this.storeRepo
      .createQueryBuilder('store')
      .leftJoin(Product, 'product', 'product.vendor_id = store.user_id')
      .addSelect('COUNT(product.id)', 'total_products')
      .groupBy('store.id')
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
    userId?: string,
  ) {
    if (!identifier) {
      throw new BadRequestException('Store identifier required');
    }

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const q = pagination.q;

    const cacheKey = `svc:store:products:${identifier}:page:${page}:limit:${limit}:q:${q || ''}:u:${userId || 'anon'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const store = await this.storeRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      relations: ['user'],
      select: [
        'id',
        'store_name',
        'slug',
        'address_city',
        'address_state',
        'address_country',
        'address_postal_code',
        'user_id',
        'status',
      ],
    });

    if (
      !store ||
      store.status !== 'active' ||
      store.user?.account_status !== 'active'
    ) {
      throw new NotFoundException('Store not found or is inactive');
    }

    const qb = addProductCardSelects(
      this.productRepo.createQueryBuilder('product'),
    )
      .where('product.store_id = :storeId', { storeId: store.id })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })
      .innerJoin(
        'product.vendor',
        'user',
        'user.account_status = :userStatus',
        { userStatus: 'active' },
      );

    if (q?.trim()) {
      qb.addSelect(
        `
        (
          ts_rank(product.search_vector, websearch_to_tsquery(:q)) * 0.7
          + similarity(product.name, :q) * 0.5
          + similarity(category.name, :q) * 0.3
        )
      `,
        'rank',
      );
      qb.andWhere(
        `(
          product.search_vector @@ websearch_to_tsquery(:q)
          OR similarity(product.name, :q) > 0.25
          OR similarity(category.name, :q) > 0.25
        )`,
        { q },
      );
      qb.orderBy('rank', 'DESC');
    } else {
      qb.orderBy('product.created_at', 'DESC');
    }

    const [products, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 🔗 WISHLIST CHECK
    let wishlistedIds = new Set<string>();
    if (userId && products.length > 0) {
      const wishlisted = await this.wishlistRepo.find({
        where: {
          user_id: userId,
          product_id: In(products.map((p) => p.id)),
        },
        select: ['product_id'],
      });
      wishlistedIds = new Set(wishlisted.map((w) => w.product_id));
    }

    const items = products.map((p) =>
      mapToProductCardData(p, {
        wishlistSet: wishlistedIds,
        extra: {
          store_name: store.store_name,
          store_slug: store.slug,
          address_city: store.address_city,
          address_state: store.address_state,
          address_country: store.address_country,
          address_postal_code: store.address_postal_code,
        },
      }),
    );

    const enriched = await this.helpers.resolveColorsForList(items);

    const data = buildPagination(enriched, total, page, limit);

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
    userId?: string,
  ) {
    if (!identifier) {
      throw new BadRequestException('Store identifier required');
    }

    if (!categoryId) {
      throw new BadRequestException('Category ID is required');
    }

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const cacheKey = `svc:store:category-products:${identifier}:${categoryId}:p:${page}:l:${limit}:u:${userId || 'anon'}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const store = await this.storeRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      relations: ['user'],
      select: [
        'id',
        'store_name',
        'slug',
        'address_city',
        'address_state',
        'address_country',
        'address_postal_code',
        'user_id',
        'status',
      ],
    });

    if (
      !store ||
      store.status !== 'active' ||
      store.user?.account_status !== 'active'
    ) {
      throw new NotFoundException('Store not found or is inactive');
    }

    const categoryExists = await this.categoryRepo.exist({
      where: { id: categoryId },
    });

    if (!categoryExists) {
      throw new NotFoundException('Category not found');
    }

    const qb = addProductCardSelects(
      this.productRepo.createQueryBuilder('product'),
    );

    // Start with core required filters
    qb.where('product.store_id = :storeId', { storeId: store.id })
      .andWhere('product.category_id = :categoryId', { categoryId })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })
      .innerJoin(
        'product.vendor',
        'user',
        'user.account_status = :userStatus',
        { userStatus: 'active' },
      );

    // Add search filter if present
    if (pagination.q?.trim()) {
      qb.andWhere(
        '(product.name ILIKE :q OR product.description ILIKE :q OR category.name ILIKE :q)',
        { q: `%${pagination.q}%` },
      );
    }

    const [products, total] = await qb
      .orderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 🔗 WISHLIST CHECK
    let wishlistedIds = new Set<string>();
    if (userId && products.length > 0) {
      const wishlisted = await this.wishlistRepo.find({
        where: {
          user_id: userId,
          product_id: In(products.map((p) => p.id)),
        },
        select: ['product_id'],
      });
      wishlistedIds = new Set(wishlisted.map((w) => w.product_id));
    }

    const items = products.map((p) =>
      mapToProductCardData(p, {
        wishlistSet: wishlistedIds,
        extra: {
          store_name: store.store_name,
          store_slug: store.slug,
          address_city: store.address_city,
          address_state: store.address_state,
          address_country: store.address_country,
          address_postal_code: store.address_postal_code,
        },
      }),
    );

    const enriched = await this.helpers.resolveColorsForList(items);

    const data = buildPagination(enriched, total, page, limit);

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
    userId?: string,
  ) {
    if (!identifier) {
      throw new BadRequestException('Store identifier required');
    }

    const perCategoryLimit = pagination.limit ?? 10;
    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const store = await this.storeRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      relations: ['user'],
      select: ['id', 'store_name', 'user_id', 'status'],
    });

    if (
      !store ||
      store.status !== 'active' ||
      store.user?.account_status !== 'active'
    ) {
      throw new NotFoundException('Store not found or is inactive');
    }

    const rows = await this.productRepo.query(
      STORE_PRODUCTS_GROUPED_BY_CATEGORY_SQL,
      [store.id, perCategoryLimit],
    );

    const wishlistSet = new Set<string>();
    if (userId && rows.length > 0) {
      const wishlisted = await this.wishlistRepo.find({
        where: {
          user_id: userId,
          product_id: In(rows.map((r: any) => r.id)),
        },
        select: ['product_id'],
      });
      wishlisted.forEach((w) => wishlistSet.add(w.product_id));
    }

    const parents = await this.categoryRepo.find({
      where: { parent_id: IsNull() },
      select: ['id', 'name', 'slug'],
      order: { created_at: 'ASC' },
    });

    const enrichedRows = await this.helpers.resolveColorsForList(rows);

    const grouped = new Map<string, any[]>();

    const extractImageUrl = (image: any): string | null => {
      if (!image) return null;
      if (typeof image === 'string') {
        try {
          return JSON.parse(image)?.url ?? null;
        } catch {
          return null;
        }
      }
      return image?.url ?? null;
    };

    for (const row of enrichedRows) {
      if (!grouped.has(row.parent_category_id)) {
        grouped.set(row.parent_category_id, []);
      }

      grouped.get(row.parent_category_id)!.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        price: Number(row.price) / 100,
        discount_price: row.discount_price
          ? Number(row.discount_price) / 100
          : null,
        on_sale: row.on_sale,
        stock: row.stock,
        rating_average: Number(row.rating_average),
        image: extractImageUrl(row.image),
        is_in_wishlist: wishlistSet.has(row.id),
        store_name: store.store_name,
        store_slug: store.slug,
        colors: row.colors || [],
        sizes: row.sizes || [],
        options: row.options || [],
        variants: (row.variants || []).map((v: any) => ({
          ...v,
          price: v.price ? Number(v.price) / 100 : 0,
          discount_price: v.discount_price
            ? Number(v.discount_price) / 100
            : null,
        })),
        shipping_cost: row.shipping_cost ? Number(row.shipping_cost) / 100 : 0,
      });
    }

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

  /* ────────────────────────────────────────────────
     THEME / TEMPLATE METHODS
  ──────────────────────────────────────────────── */

  async getTemplates() {
    const templates = await this.templateRepo.find({
      order: { name: 'ASC' },
    });
    return {
      message: 'Templates retrieved successfully',
      data: templates,
    };
  }

  async getStoreTheme(slug: string) {
    const store = await this.storeRepo.findOne({
      where: { slug },
      relations: ['user', 'theme_setting', 'theme_setting.template'],
      select: ['id', 'slug', 'user_id', 'status'],
    });

    if (
      !store ||
      store.status !== 'active' ||
      (store.user?.account_status !== 'active' &&
        store.user?.account_status !== 'pending')
    ) {
      throw new NotFoundException('Store not found or is inactive');
    }

    if (!store.theme_setting || !store.theme_setting.template) {
      // Return default if no explicit setting is found
      const defaultTemplate = await this.templateRepo.findOne({
        where: { name: 'Default' },
      });

      return {
        message: 'Store theme retrieved',
        data: {
          template: defaultTemplate,
          custom_config: {}, // No overrides
        },
      };
    }

    return {
      message: 'Store theme retrieved',
      data: {
        template: store.theme_setting.template,
        custom_config: store.theme_setting.custom_config,
      },
    };
  }
}
