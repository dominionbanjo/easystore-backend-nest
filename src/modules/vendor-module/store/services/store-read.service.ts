import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PaginationQueryDto as PaginationDto } from 'src/common/dto/pagination.dto';
import { ProductCategory } from 'src/modules/commerce-module/product-category/entities/product-category.entity';
import {
  Product,
  ProductStatus,
} from 'src/modules/commerce-module/product/entities/product.entity';
import { STORE_PRODUCTS_GROUPED_BY_CATEGORY_SQL } from 'src/modules/commerce-module/product/queries/products-grouped-by-category.store.sql';
import { CacheService } from 'src/modules/shared-module/cache/cache.service';
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
      .addSelect((subQ) => {
        return subQ
          .select('COUNT(product.id)')
          .from(Product, 'product')
          .where('product.vendor_id = store.user_id');
      }, 'total_products')
      .where('store.store_name ILIKE :q', { q: `%${q}%` });

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
      relations: ['user'],
    });

    if (store && store.user) {
      const { password: _, ...safeUser } = store.user as any;
      (store as any).user = {
        first_name: safeUser.first_name,
        last_name: safeUser.last_name,
        username: safeUser.username,
        avatar: safeUser.avatar,
      };
    }

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const totalProductsCount = await this.productRepo.count({
      where: { vendor_id: store.user_id },
    });

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
          'product.discount_price',
          'product.on_sale',
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
        price: Number(p.price) / 100,
        image: p.image?.url ?? null,
        rating_average: Number(p.rating_average),
        stock: p.stock,
        discount_price: p.discount_price
          ? Number(p.discount_price) / 100
          : null,
        on_sale: p.on_sale,
      }));

      productsResult = buildPagination(items, total, page, limit);
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

    const response = {
      message: 'Store retrieved successfully',
      store: {
        ...store,
        total_products: totalProductsCount,
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
      .addSelect((subQ) => {
        return subQ
          .select('COUNT(product.id)')
          .from(Product, 'product')
          .where('product.vendor_id = store.user_id');
      }, 'total_products');

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
      select: [
        'id',
        'store_name',
        'address_city',
        'address_state',
        'address_country',
        'address_postal_code',
      ],
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
        'product.colors',
        'product.sizes',
        'product.discount_price',
        'product.on_sale',
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
      price: Number(p.price) / 100,
      image: p.image?.url ?? null,
      rating_average: Number(p.rating_average),
      stock: p.stock,
      store_name: store.store_name,
      address_city: store.address_city,
      address_state: store.address_state,
      address_country: store.address_country,
      address_postal_code: store.address_postal_code,
      created_at: p.created_at,
      category: p.category_ref?.name,
      colors: p.colors || [],
      sizes: p.sizes || [],
      discount_price: p.discount_price ? Number(p.discount_price) / 100 : null,
      on_sale: p.on_sale,
    }));

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

    const store = await this.storeRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      select: [
        'id',
        'store_name',
        'address_city',
        'address_state',
        'address_country',
        'address_postal_code',
      ],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const categoryExists = await this.categoryRepo.exist({
      where: { id: categoryId },
    });

    if (!categoryExists) {
      throw new NotFoundException('Category not found');
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
        'product.colors',
        'product.sizes',
        'product.discount_price',
        'product.on_sale',
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
      price: Number(p.price) / 100,
      image: p.image?.url ?? null,
      rating_average: Number(p.rating_average),
      stock: p.stock,
      store_name: store.store_name,
      address_city: store.address_city,
      address_state: store.address_state,
      address_country: store.address_country,
      address_postal_code: store.address_postal_code,
      created_at: p.created_at,
      category: p.category_ref?.name,
      colors: p.colors || [],
      sizes: p.sizes || [],
      discount_price: p.discount_price ? Number(p.discount_price) / 100 : null,
      on_sale: p.on_sale,
    }));

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
  ) {
    if (!identifier) {
      throw new BadRequestException('Store identifier required');
    }

    const perCategoryLimit = pagination.limit ?? 10;
    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const store = await this.storeRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      select: ['id', 'store_name'],
    });

    if (!store) {
      throw new NotFoundException('Store not found');
    }

    const rows = await this.productRepo.query(
      STORE_PRODUCTS_GROUPED_BY_CATEGORY_SQL,
      [store.id, perCategoryLimit],
    );

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
        colors: row.colors || [],
        sizes: row.sizes || [],
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
}
