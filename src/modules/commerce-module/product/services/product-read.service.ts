import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Product, ProductStatus } from '../entities/product.entity';
import { ProductVariant } from '../entities/product-variant.entity';
import { ProductCategory } from '../../product-category/entities/product-category.entity';

import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { WishlistService } from '../../wishlist/wishlist.service';
import { PRODUCTS_GROUPED_BY_CATEGORY_SQL } from '../queries/products-grouped-by-category.sql';
import { buildPagination } from 'src/utils/response/pagination.util';
import {
  addProductCardSelects,
  mapToProductCardData,
} from '../utils/product-card.util';
import { normalizeJson } from 'src/utils/response/normalizeJson';
import { ProductHelperService } from './product-helper.service';
import { applyProductSort } from 'src/utils/helpers/product-sort.util';

@Injectable()
export class ProductReadService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    private readonly wishlistService: WishlistService,
    private readonly helpers: ProductHelperService,
  ) {}

  async getProductsGroupedByCategory(
    pagination: PaginationQueryDto = { limit: 10 },
    userId?: string,
  ) {
    const perCategoryLimit = pagination.limit ?? 10;
    const rows = await this.productRepo.query(
      PRODUCTS_GROUPED_BY_CATEGORY_SQL,
      [perCategoryLimit],
    );

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const parents = await this.categoryRepo.find({
      where: { parent_id: IsNull() },
      select: ['id', 'name', 'slug'],
      order: { created_at: 'ASC' },
    });

    const grouped = new Map<string, any[]>();

    for (const row of rows) {
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
        store_name: row.store_name,
        store_slug: row.store_slug || row.store_name, // Fallback if slug is missing in SQL
        address_city: row.address_city,
        address_state: row.address_state,
        address_country: row.address_country,
        address_postal_code: row.address_postal_code,
        image: this.helpers.extractImageUrl(row.image),
        is_in_wishlist: wishlistSet.has(row.id),
        options: row.options || [],
        variants: (row.variants || []).map((v: any) => ({
          ...v,
          price: Number(v.price) / 100,
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
      message: 'Categories with products retrieved successfully',
      data,
    };
  }

  async getFeaturedProducts(
    query: PaginationQueryDto = { page: 1, limit: 20 },
    userId?: string,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const queryBuilder = addProductCardSelects(
      this.productRepo.createQueryBuilder('product'),
      { withStore: true },
    )
      .innerJoin(
        'users',
        'user',
        'user.id = product.vendor_id AND user.account_status = :status_user',
        { status_user: 'active' },
      )
      .where('product.status = :status_prod', {
        status_prod: ProductStatus.ACTIVE,
      })
      .andWhere('product.featured = :featured', { featured: true })
      .andWhere('store.status = :store_status', { store_status: 'active' });

    applyProductSort(queryBuilder, 'newest', { state: query.state });

    const [products, total] = await queryBuilder
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    const items = products.map((p) =>
      mapToProductCardData(p, {
        wishlistSet,
        extra: {
          category: p.category_ref?.name,
        },
      }),
    );

    return {
      message: 'Featured products retrieved successfully',
      data: buildPagination(items, total, page, limit),
    };
  }

  async getAllProducts(
    pagination: PaginationQueryDto = { page: 1, limit: 20 },
    userId?: string,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const qb = addProductCardSelects(
      this.productRepo.createQueryBuilder('product'),
      { withStore: true },
    )
      .innerJoin(
        'users',
        'user',
        'user.id = product.vendor_id AND user.account_status = :status_user',
        { status_user: 'active' },
      )
      .where('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })
      .andWhere('store.status = :store_status', { store_status: 'active' });

    // Apply sorting
    applyProductSort(qb, pagination.sort, {
      state: pagination.state,
    });

    const [products, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = products.map((p) =>
      mapToProductCardData(p, {
        wishlistSet,
        extra: {
          category: p.category_ref?.name,
        },
      }),
    );

    return {
      message: 'Products retrieved successfully',
      data: buildPagination(data, total, page, limit),
    };
  }

  async getProductsByCategory(
    identifier: string,
    pagination: PaginationQueryDto = { page: 1, limit: 20 },
    userId?: string,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const category = await this.categoryRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      select: ['id', 'name', 'slug'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const qb = addProductCardSelects(
      this.productRepo.createQueryBuilder('product'),
      { withStore: true },
    )
      .innerJoin(
        'users',
        'user',
        'user.id = product.vendor_id AND user.account_status = :status_user',
        { status_user: 'active' },
      )
      .where(
        `product.category_id IN (
          WITH RECURSIVE category_tree AS (
            SELECT id
            FROM product_categories
            WHERE id = :categoryId
            UNION ALL
            SELECT c.id
            FROM product_categories c
            JOIN category_tree ct
            ON c.parent_id = ct.id
          )
          SELECT id FROM category_tree
        )`,
        { categoryId: category.id },
      )
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })
      .andWhere('store.status = :store_status', { store_status: 'active' });

    // Apply sorting
    applyProductSort(qb, pagination.sort, {
      state: pagination.state,
    });

    const [products, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price) / 100,
      image: p.image?.url ?? null,
      rating_average: Number(p.rating_average),
      stock: p.stock,
      store_name: p.store?.store_name,
      store_slug: p.store?.slug,
      address_city: p.store?.address_city,
      address_state: p.store?.address_state,
      address_country: p.store?.address_country,
      address_postal_code: p.store?.address_postal_code,
      is_in_wishlist: wishlistSet.has(p.id),
      category: category.name,
      discount_price: p.discount_price ? Number(p.discount_price) / 100 : null,
      on_sale: p.on_sale,
      options: p.options || [],
      variants: (p.variants || []).map((v: any) => ({
        ...v,
        price: Number(v.price) / 100,
        discount_price: v.discount_price
          ? Number(v.discount_price) / 100
          : null,
      })),
    }));

    return {
      message: 'Category products retrieved successfully',
      category,
      data: buildPagination(data, total, page, limit),
    };
  }

  async getSingle(identifier: string, userId?: string) {
    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const product = await this.productRepo
      .createQueryBuilder('product')
      .leftJoin('product.variants', 'variants')
      .leftJoin('product.category_ref', 'category')
      .leftJoin('product.store', 'store')
      .leftJoin('product.reviews', 'reviews')
      .leftJoin('reviews.user', 'reviewUser')
      .where(
        isUUID ? 'product.id = :identifier' : 'product.slug = :identifier',
        { identifier },
      )
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })
      .andWhere('store.status = :storeStatus', { storeStatus: 'active' })
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.description',
        'product.price',
        'product.discount_price',
        'product.on_sale',
        'product.stock',
        'product.image',
        'product.gallery',
        'product.highlights',
        'product.specs',
        'product.shipping_note',
        'product.returns_note',
        'product.options',
        'product.rating_average',
        'product.review_count',
        'product.vendor_id',
        'product.category_id',
        'product.store_id',
        'variants.id',
        'variants.product_id',
        'variants.sku',
        'variants.combinations',
        'variants.price',
        'variants.discount_price',
        'variants.stock',
        'variants.image_url',
        'category.id',
        'category.name',
        'store.id',
        'store.store_name',
        'store.slug',
        'store.rating_average',
        'store.rating_count',
        'store.logo',
        'store.address_city',
        'store.address_state',
        'store.address_country',
        'store.address_postal_code',
        'reviews.id',
        'reviews.rating',
        'reviews.comment',
        'reviews.created_at',
        'reviewUser.id',
        'reviewUser.first_name',
        'reviewUser.last_name',
        'reviewUser.avatar',
      ])
      .orderBy('reviews.created_at', 'DESC')
      .addOrderBy('product.created_at', 'DESC')
      .getOne();

    if (!product) {
      throw new NotFoundException('Product not found or is inactive');
    }

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const store = product.store
      ? {
          id: product.store.id,
          store_name: product.store.store_name,
          slug: product.store.slug,
          rating_average: product.store.rating_average,
          rating_count: product.store.rating_count,
          logo: product.store.logo,
          address_city: product.store.address_city,
          address_state: product.store.address_state,
          address_country: product.store.address_country,
          address_postal_code: product.store.address_postal_code,
        }
      : null;

    const reviews = (product.reviews || []).map((review) => ({
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      user: review.user
        ? {
            id: review.user.id,
            first_name: review.user.first_name,
            last_name: review.user.last_name,
            avatar: review.user.avatar,
          }
        : null,
    }));

    const variants = (product.variants || []).map((v) => ({
      ...v,
      price: Number(v.price) / 100,
      discount_price: v.discount_price ? Number(v.discount_price) / 100 : null,
    }));

    const related = await this.productRepo
      .createQueryBuilder('p')
      .leftJoin('p.store', 'store')
      .leftJoin('p.category_ref', 'category')
      .leftJoin('p.variants', 'variants')
      .select([
        'p.id',
        'p.name',
        'p.slug',
        'p.price',
        'p.image',
        'p.rating_average',
        'p.stock',
        'p.created_at',
        'p.options',
        'p.discount_price',
        'p.on_sale',
        'category.id',
        'category.name',
        'category.slug',
        'store.id',
        'store.store_name',
        'store.slug',
        'store.address_city',
        'store.address_state',
        'store.address_country',
        'store.address_postal_code',
        'variants.id',
        'variants.combinations',
        'variants.price',
        'variants.discount_price',
        'variants.stock',
        'variants.image_url',
      ])
      .where('p.category_id = :categoryId', {
        categoryId: product.category_id,
      })
      .andWhere('p.store_id = :storeId', {
        storeId: product.store_id,
      })
      .andWhere('p.id != :currentId', {
        currentId: product.id,
      })
      .orderBy('p.total_sold', 'DESC')
      .addOrderBy('p.created_at', 'DESC')
      .limit(10)
      .getMany();

    const related_products = related.map((p) =>
      mapToProductCardData(p, {
        wishlistSet,
        extra: {
          category: p.category_ref?.name,
        },
      }),
    );

    const { store: _s, reviews: _r, variants: _v, ...productOnly } = product;
    productOnly.specs = normalizeJson(productOnly.specs);

    return {
      message: 'Product retrieved successfully',
      product,
      data: {
        product: {
          ...productOnly,
          price: Number(product.price) / 100,
          discount_price: product.discount_price
            ? Number(product.discount_price) / 100
            : null,
          options: product.options || [],
          variants,
          is_in_wishlist: wishlistSet.has(product.id),
          store_id: product.store_id || product.store?.id,
        },
        store,
        reviews,
        related_products,
      },
    };
  }

  async getVendorSingle(identifier: string, storeId: string) {
    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const product = await this.productRepo
      .createQueryBuilder('product')
      .leftJoin('product.variants', 'variants')
      .leftJoin('product.category_ref', 'category')
      .leftJoin('product.store', 'store')
      .where(
        isUUID
          ? 'product.id = :identifier AND product.store_id = :storeId'
          : 'product.slug = :identifier AND product.store_id = :storeId',
        { identifier, storeId },
      )
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.description',
        'product.price',
        'product.discount_price',
        'product.on_sale',
        'product.stock',
        'product.image',
        'product.gallery',
        'product.highlights',
        'product.specs',
        'product.shipping_note',
        'product.returns_note',
        'product.options',
        'product.rating_average',
        'product.tags',
        'product.status',
        'product.featured',
        'product.total_sold',
        'product.vendor_id',
        'product.category_id',
        'product.store_id',
        'variants.id',
        'variants.product_id',
        'variants.sku',
        'variants.combinations',
        'variants.price',
        'variants.discount_price',
        'variants.stock',
        'variants.image_url',
        'category.id',
        'category.name',
        'store.id',
        'store.store_name',
      ])
      .getOne();

    if (!product) {
      throw new NotFoundException('Product not found in your store');
    }

    const variants = (product.variants || []).map((v) => ({
      ...v,
      price: Number(v.price) / 100,
      discount_price: v.discount_price ? Number(v.discount_price) / 100 : null,
    }));

    const { store: _s, variants: _v, ...productOnly } = product;
    productOnly.specs = normalizeJson(productOnly.specs);

    return {
      message: 'Vendor product retrieved successfully',
      data: {
        product: {
          ...productOnly,
          price: Number(product.price) / 100,
          discount_price: product.discount_price
              ? Number(product.discount_price) / 100
              : null,
          options: product.options || [],
          variants,
          store_id: product.store_id || product.store?.id,
        },
      },
    };
  }


  async getByStore(
    storeId: string,
    pagination: PaginationQueryDto = { page: 1, limit: 20 },
    userId?: string,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const qb = addProductCardSelects(
      this.productRepo.createQueryBuilder('product'),
      { withStore: true },
    )
      .innerJoin(
        'users',
        'user',
        'user.id = product.vendor_id AND user.account_status = :status_user',
        { status_user: 'active' },
      )
      .where('product.store_id = :storeId', { storeId })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })
      .andWhere('store.status = :store_status', { store_status: 'active' })
      .orderBy('product.created_at', 'DESC');

    const [products, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = products.map((p) =>
      mapToProductCardData(p, {
        wishlistSet,
        extra: {
          category: p.category_ref?.name,
        },
      }),
    );

    return {
      message: 'Store products retrieved successfully',
      data: buildPagination(items, total, page, limit),
    };
  }

  async lookupByBarcode(barcode: string, storeId: string) {
    const product = await this.productRepo.findOne({
      where: { barcode, store_id: storeId, status: ProductStatus.ACTIVE },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        image: true,
        stock: true,
      },
    });
    if (product) return { product, variant: null };

    const variant = await this.variantRepo.findOne({
      where: { barcode },
      relations: ['product'],
      select: {
        id: true,
        price: true,
        stock: true,
        combinations: true,
        image_url: true,
        product: {
          id: true,
          name: true,
          slug: true,
          image: true,
          store_id: true,
          status: true,
        },
      },
    });
    if (variant && variant.product.store_id === storeId && variant.product.status === ProductStatus.ACTIVE) {
      return { product: variant.product, variant };
    }

    throw new NotFoundException('Product not found for this barcode');
  }
}
