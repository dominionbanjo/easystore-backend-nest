import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationQueryDto as PaginationDto } from 'src/common/dto/pagination.dto';
import {
  Product,
  ProductStatus,
} from 'src/modules/commerce-module/product/entities/product.entity';
import { StoreAnalytics } from 'src/modules/vendor-module/store-analytics/entities/store-analytics.entity';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
import { buildPagination } from 'src/utils/response/pagination.util';
import { Store } from '../entities/store.entity';

/* ────────────────────────────────────────────────
   TRENDING RANKING WEIGHTS
   score = LN(1 + sales) * SALES_WEIGHT
         + rating_average * RATING_WEIGHT
         + LN(1 + products) * PRODUCTS_WEIGHT
   LN dampens large order/product counts.
──────────────────────────────────────────────── */
const TRENDING_WEIGHTS = {
  sales: 3.0,
  rating: 2.0,
  products: 1.5,
} as const;

const TRENDING_SCORE_SQL = `(
  LN(1 + COALESCE(analytics.total_orders, 0)) * ${TRENDING_WEIGHTS.sales}
  + COALESCE(store.rating_average, 0) * ${TRENDING_WEIGHTS.rating}
  + LN(1 + COUNT(product.id)) * ${TRENDING_WEIGHTS.products}
)`;

@Injectable()
export class StoreCatalogService {
  constructor(
    private readonly cache: CacheService,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
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
        'store.cover_image',
        'store.rating_average',
        'store.slug',
        'store.created_at',
        'store.user_id',
      ])
      .leftJoin(
        Product,
        'product',
        'product.vendor_id = store.user_id AND product.status = :productStatus',
        { productStatus: ProductStatus.ACTIVE },
      )
      .addSelect('COUNT(product.id)', 'total_products')
      .groupBy('store.id')
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
      cover_image: store.cover_image,
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

  async getAllStores(pagination: PaginationDto = { page: 1, limit: 20 }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;
    const isTrending = pagination.sort === 'trending';

    const cacheKey = `svc:store:list:${page}-${limit}:${isTrending ? 'trending' : 'default'}`;
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
        'store.cover_image',
        'store.rating_average',
        'store.slug',
        'store.created_at',
        'store.user_id',
      ]);

    if (isTrending) {
      qb.leftJoin(
        Product,
        'product',
        'product.vendor_id = store.user_id AND product.status = :productStatus',
        { productStatus: ProductStatus.ACTIVE },
      )
        .addSelect('COUNT(product.id)', 'total_products')
        .leftJoin(StoreAnalytics, 'analytics', 'analytics.store_id = store.id')
        .addSelect('COALESCE(analytics.total_orders, 0)', 'total_orders')
        .addSelect(TRENDING_SCORE_SQL, 'score')
        .groupBy('store.id')
        .addGroupBy('analytics.total_orders')
        .having('COUNT(product.id) > 0')
        .orderBy('score', 'DESC')
        .addOrderBy('total_orders', 'DESC')
        .addOrderBy('store.created_at', 'DESC');
    } else {
      qb.leftJoin(
        Product,
        'product',
        'product.vendor_id = store.user_id AND product.status = :productStatus',
        { productStatus: ProductStatus.ACTIVE },
      )
        .addSelect('COUNT(product.id)', 'total_products')
        .groupBy('store.id')
        .orderBy('store.created_at', 'DESC');
    }

    if (pagination.state) {
      qb.andWhere('store.address_state = :state', { state: pagination.state });
    }

    qb.skip((page - 1) * limit).take(limit);

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
      cover_image: store.cover_image,
      rating_average: store.rating_average,
      slug: store.slug,
      total_products: Number(raw[index].total_products),
      ...(isTrending
        ? { total_orders: Number(raw[index].total_orders ?? 0) }
        : {}),
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
      .leftJoin(
        Product,
        'product',
        'product.vendor_id = store.user_id AND product.status = :productStatus',
        { productStatus: ProductStatus.ACTIVE },
      )
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
}
