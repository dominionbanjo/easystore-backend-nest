import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Product, ProductStatus } from '../entities/product.entity';
import { ProductCategory } from '../../product-category/entities/product-category.entity';
import { ProductColor } from 'src/modules/shared-module/colors/entities/color.entity';
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

    @InjectRepository(ProductColor)
    private readonly colorRepo: Repository<ProductColor>,

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

    const enrichedRows = await this.helpers.resolveColorsForList(rows);

    const grouped = new Map<string, any[]>();

    for (const row of enrichedRows) {
      if (!grouped.has(row.parent_category_id)) {
        grouped.set(row.parent_category_id, []);
      }

      grouped.get(row.parent_category_id)!.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        price: Number(row.price),
        discount_price: row.discount_price ? Number(row.discount_price) : null,
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
        colors: row.colors || [],
        sizes: row.sizes || [],
        options: row.options || [],
        variants: row.variants || [],
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
      .where('product.featured = :featured', { featured: true })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      });

    const [products, total] = await queryBuilder
      .orderBy('product.created_at', 'DESC')
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

    const enriched = await this.helpers.resolveColorsForList(items);

    return {
      message: 'Featured products retrieved successfully',
      data: buildPagination(enriched, total, page, limit),
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
    ).where('product.status = :status', {
      status: ProductStatus.ACTIVE,
    });

    // Apply sorting
    applyProductSort(qb, pagination.sort);

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

    const items = await this.helpers.resolveColorsForList(data);

    return {
      message: 'Products retrieved successfully',
      data: buildPagination(items, total, page, limit),
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
      .where('product.category_id = :categoryId', { categoryId: category.id })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      });

    // Apply sorting
    applyProductSort(qb, pagination.sort);

    const [products, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const data = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
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
      colors: p.colors || [],
      sizes: p.sizes || [],
      discount_price: p.discount_price ? Number(p.discount_price) : null,
      on_sale: p.on_sale,
      options: p.options || [],
      variants: p.variants || [],
    }));

    const items = await this.helpers.resolveColorsForList(data);

    return {
      message: 'Category products retrieved successfully',
      category,
      data: buildPagination(items, total, page, limit),
    };
  }

  async getSingle(identifier: string, userId?: string) {
    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const product = await this.productRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      relations: [
        'category_ref',
        'store',
        'reviews',
        'reviews.user',
        'variants',
      ],
      order: {
        reviews: {
          created_at: 'DESC',
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const resolvedColors =
      product.colors && product.colors.length
        ? await this.colorRepo
            .createQueryBuilder('c')
            .select(['c.id', 'c.name', 'c.hex'])
            .where('c.id = ANY(:colorIds)', {
              colorIds: product.colors,
            })
            .getMany()
        : [];

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

    const reviews = product.reviews.map((review) => ({
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
      .leftJoinAndSelect('p.store', 'store')
      .leftJoinAndSelect('p.category_ref', 'category')
      .leftJoinAndSelect('p.variants', 'variants')
      .where('p.category_id = :categoryId', {
        categoryId: product.category_id,
      })
      .andWhere('p.id != :currentId', {
        currentId: product.id,
      })
      .orderBy('p.total_sold', 'DESC')
      .addOrderBy('p.created_at', 'DESC')
      .limit(10)
      .getMany();

    const related_products = related.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      discount_price: p.discount_price ? Number(p.discount_price) : null,
      on_sale: p.on_sale,
      stock: p.stock,
      rating_average: Number(p.rating_average),
      image: p.image?.url ?? null,
      colors: p.colors || [],
      sizes: p.sizes || [],
      options: p.options || [],
      variants: p.variants || [],
      store_name: p.store?.store_name,
      store_slug: p.store?.slug,
      address_city: p.store?.address_city,
      address_state: p.store?.address_state,
      address_country: p.store?.address_country,
      category: p.category_ref?.name,
      is_in_wishlist: wishlistSet.has(p.id),
    }));

    const enriched_related =
      await this.helpers.resolveColorsForList(related_products);

    const { store: _s, reviews: _r, variants: _v, ...productOnly } = product;
    productOnly.specs = normalizeJson(productOnly.specs);

    return {
      message: 'Product retrieved successfully',
      product, // Raw entity with Kobo prices (used by internal services like OrderValidation)
      data: {
        product: {
          ...productOnly,
          price: Number(product.price) / 100,
          discount_price: product.discount_price
            ? Number(product.discount_price) / 100
            : null,
          shipping_cost: product.shipping_cost
            ? Number(product.shipping_cost) / 100
            : null,
          colors: resolvedColors,
          options: product.options || [],
          variants,
          is_in_wishlist: wishlistSet.has(product.id),
        },
        store,
        reviews,
        related_products: enriched_related,
      },
    };
  }

  async getByStore(
    storeId: string,
    pagination: PaginationQueryDto = { page: 1, limit: 20 },
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const [products, total] = await this.productRepo.findAndCount({
      where: { store: { id: storeId } },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
      relations: ['category_ref', 'store', 'variants'],
    });

    const items = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      discount_price: p.discount_price ? Number(p.discount_price) : null,
      on_sale: p.on_sale,
      image: p.image?.url ?? null,
      rating_average: Number(p.rating_average),
      stock: p.stock,
      store_name: p.store?.store_name,
      store_slug: p.store?.slug,
      address_city: p.store?.address_city,
      address_state: p.store?.address_state,
      address_country: p.store?.address_country,
      address_postal_code: p.store?.address_postal_code,
      created_at: p.created_at,
      category: p.category_ref?.name,
      colors: p.colors || [],
      sizes: p.sizes || [],
      options: p.options || [],
      variants: p.variants || [],
    }));

    const enriched = await this.helpers.resolveColorsForList(items);

    return {
      message: 'Store products retrieved successfully',
      data: buildPagination(enriched, total, page, limit),
    };
  }
}
