import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, FindOptionsWhere } from 'typeorm';
import { StoreStaff } from '../entities/store-staff.entity';
import { PaginationQueryDto as PaginationDto } from 'src/common/dto/pagination.dto';
import { ProductCategory } from 'src/modules/commerce-module/product-category/entities/product-category.entity';
import {
  Product,
  ProductStatus,
} from 'src/modules/commerce-module/product/entities/product.entity';
import { Wishlist } from 'src/modules/commerce-module/wishlist/entities/wishlist.entity';
import { STORE_PRODUCTS_GROUPED_BY_CATEGORY_SQL } from 'src/modules/commerce-module/product/queries/products-grouped-by-category.store.sql';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import {
  addProductCardSelects,
  mapToProductCardData,
} from 'src/modules/commerce-module/product/utils/product-card.util';
import { mapToPublicStore } from '../utils/store-sanitizer.util';
import { buildPagination } from 'src/utils/response/pagination.util';
import { StoreTemplate } from '../entities/store-template.entity';
import { Store } from '../entities/store.entity';
import { StoreHelperService } from './store-helper.service';

@Injectable()
export class StoreDetailService {
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

    @InjectRepository(StoreStaff)
    private readonly staffRepo: Repository<StoreStaff>,
  ) {}

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

    // NOTE: Products are intentionally NOT included in this query.
    // They are fetched separately by the frontend via getStoreProducts().
    // Keeping them separate avoids loading heavy variant/JSONB data
    // on every store detail navigation and keeps cache granularity high.
    let store: Store | null = null;
    if (isUUID) {
      store = await this.storeRepo.findOne({
        where: { id: identifier },
        select: {
          id: true,
          store_name: true,
          slug: true,
          subdomain: true,
          category: true,
          description: true,
          logo: true,
          cover_image: true,
          email: true,
          phone_number: true,
          rating_average: true,
          rating_count: true,
          address_city: true,
          address_state: true,
          address_country: true,
          address_postal_code: true,
          status: true,
          user_id: true,
          total_products: true,
          created_at: true,
          user: {
            first_name: true,
            last_name: true,
            username: true,
            avatar: true,
            account_status: true,
          },
        },
        relations: ['user', 'theme_setting', 'theme_setting.template'],
      });
    } else {
      store = await this.storeRepo.findOne({
        where: [{ subdomain: identifier }, { slug: identifier }],
        select: {
          id: true,
          store_name: true,
          slug: true,
          subdomain: true,
          category: true,
          description: true,
          logo: true,
          cover_image: true,
          email: true,
          phone_number: true,
          rating_average: true,
          rating_count: true,
          address_city: true,
          address_state: true,
          address_country: true,
          address_postal_code: true,
          status: true,
          user_id: true,
          total_products: true,
          created_at: true,
          user: {
            first_name: true,
            last_name: true,
            username: true,
            avatar: true,
            account_status: true,
          },
        },
        relations: ['user', 'theme_setting', 'theme_setting.template'],
      });
    }

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const isOwner = !!(userId && store.user_id === userId);
    if (
      !isOwner &&
      (store.status !== 'active' || store.user?.account_status !== 'active')
    ) {
      throw new NotFoundException('Store not found or is inactive');
    }

    const totalProductsCount = store.total_products ?? 0;

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

    let themeData: StoreThemeData | null = null;
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

  async getStoreByUser(userId: string, storeId?: string) {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    const where: FindOptionsWhere<Store> = storeId
      ? { id: storeId, user_id: userId }
      : { user_id: userId };

    const store = await this.storeRepo.findOne({
      where,
      relations: ['user'],
      order: storeId ? undefined : { created_at: 'DESC' },
    });

    if (!store) {
      throw new NotFoundException('Store not found for this user');
    }

    return store;
  }

  async getStoresByUser(userId: string) {
    return this.storeRepo.find({
      where: { user_id: userId },
      select: ['id', 'store_name', 'slug', 'logo', 'status', 'created_at'],
      order: { created_at: 'DESC' },
    });
  }

  async getTotalProductsForStore(storeId: string): Promise<number> {
    return this.productRepo.count({
      where: { store_id: storeId },
    });
  }

  async validateVendorForOnline(userId: string, storeId?: string) {
    if (!userId) {
      throw new BadRequestException('Vendor user ID is required');
    }

    const store = await this.storeRepo.findOne({
      where: storeId ? { id: storeId, user_id: userId } : { user_id: userId },
      select: [
        'id',
        'user_id',
        'store_name',
        'payout_verified',
        'recipient_code',
        'escrow_enabled',
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

    if (!store.escrow_enabled) {
      throw new BadRequestException(
        `Vendor ${store.store_name} has escrow payments disabled`,
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

  async isStoreStaff(storeId: string, userId: string): Promise<boolean> {
    if (!storeId || !userId) return false;
    return this.staffRepo.exists({
      where: { store_id: storeId, user_id: userId, status: 'active' },
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
      where: isUUID
        ? { id: identifier }
        : [{ subdomain: identifier }, { slug: identifier }],
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

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const isOwner = !!(userId && store.user_id === userId);
    if (
      !isOwner &&
      (store.status !== 'active' || store.user?.account_status !== 'active')
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
      where: isUUID
        ? { id: identifier }
        : [{ subdomain: identifier }, { slug: identifier }],
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

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const isOwner = !!(userId && store.user_id === userId);
    if (
      !isOwner &&
      (store.status !== 'active' || store.user?.account_status !== 'active')
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
      where: isUUID
        ? { id: identifier }
        : [{ subdomain: identifier }, { slug: identifier }],
      relations: ['user'],
      select: ['id', 'store_name', 'user_id', 'status', 'slug'],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const isOwner = !!(userId && store.user_id === userId);
    if (
      !isOwner &&
      (store.status !== 'active' || store.user?.account_status !== 'active')
    ) {
      throw new NotFoundException('Store not found or is inactive');
    }

    const rows = await this.productRepo.query<StoreGroupedProductRow[]>(
      STORE_PRODUCTS_GROUPED_BY_CATEGORY_SQL,
      [store.id, perCategoryLimit],
    );

    const wishlistSet = new Set<string>();
    if (userId && rows.length > 0) {
      const wishlisted = await this.wishlistRepo.find({
        where: {
          user_id: userId,
          product_id: In(rows.map((r) => r.id)),
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
    const grouped = new Map<string, GroupedProductItem[]>();

    const extractImageUrl = (image: unknown): string | null => {
      if (!image) return null;
      if (typeof image === 'string') {
        try {
          const parsed = JSON.parse(image) as { url?: string | null } | null;
          return parsed?.url ?? null;
        } catch {
          return null;
        }
      }
      if (typeof image === 'object') {
        const obj = image as { url?: string | null };
        return obj.url ?? null;
      }
      return null;
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
        variants: (row.variants || []).map((v) => ({
          ...v,
          price: v.price ? Number(v.price) / 100 : 0,
          discount_price: v.discount_price
            ? Number(v.discount_price) / 100
            : null,
        })),
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
}

interface StoreThemeData {
  template: StoreTemplate | null;
  custom_config: Record<string, unknown>;
}

interface StoreGroupedProductRow {
  id: string;
  name: string;
  slug: string;
  price: string;
  discount_price: string | null;
  on_sale: boolean;
  stock: number;
  rating_average: string;
  image: unknown;
  parent_category_id: string;
  colors?: unknown[];
  sizes?: unknown[];
  options?: unknown[];
  variants?: Array<{ price: string; discount_price: string | null }>;
}

export interface GroupedProductItem {
  id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  on_sale: boolean;
  stock: number;
  rating_average: number;
  image: string | null;
  is_in_wishlist: boolean;
  store_name: string;
  store_slug: string;
  colors: unknown[];
  sizes: unknown[];
  options: unknown[];
  variants: unknown[];
}
