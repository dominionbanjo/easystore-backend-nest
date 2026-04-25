import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductStatus } from '../entities/product.entity';
import { ProductSearchDto } from '../dto/product-search.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { WishlistService } from '../../wishlist/wishlist.service';
import { buildPagination } from 'src/utils/response/pagination.util';
import {
  addProductCardSelects,
  mapToProductCardData,
} from '../utils/product-card.util';

@Injectable()
export class ProductSearchService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly wishlistService: WishlistService,
  ) {}

  async search(params: ProductSearchDto, userId?: string) {
    const {
      q,
      page = 1,
      limit = 20,
      minPrice,
      maxPrice,
      country,
      state,
      city,
      rating,
      inStock,
      filter = {},
    } = params;

    if (!q?.trim()) {
      throw new BadRequestException('Search query is required');
    }

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    // Build a prefix tsquery: "fant" → "fant:*", "jal biy" → "jal:* & biy:*"
    // Strip special characters (like '&', '|', '!') that are tsquery operators
    // to avoid syntax errors when the user's search term contains them.
    const tsPrefix = q
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')  // strip special chars
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `${w}:*`)
      .join(' & ');

    // For direct ILIKE substring matching — catches "fant" inside "fanta can drink"
    const qLike = `%${q.trim()}%`;

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
      .innerJoin(
        'stores',
        'vendorStore',
        'vendorStore.user_id = product.vendor_id AND vendorStore.status = :store_status',
        { store_status: 'active' },
      )
      .addSelect(
        `
      (
        COALESCE(ts_rank(product.search_vector, websearch_to_tsquery(:q)), 0) * 0.7
        + CASE WHEN product.name ILIKE :qLike THEN 0.8 ELSE 0 END
        + word_similarity(:q, product.name) * 0.6
        + word_similarity(:q, COALESCE(category.name, '')) * 0.3
      )
    `,
        'rank',
      )
      .where(
        `
      product.status = :status
      AND (
        product.search_vector @@ websearch_to_tsquery(:q)
        OR product.search_vector @@ to_tsquery('simple', :tsPrefix)
        OR product.name ILIKE :qLike
        OR word_similarity(:q, product.name) > 0.3
        OR product.category_id IN (
          WITH RECURSIVE category_tree AS (
            SELECT id
            FROM product_categories
            WHERE word_similarity(:q, name) > 0.3
            UNION ALL
            SELECT c.id
            FROM product_categories c
            JOIN category_tree ct
            ON c.parent_id = ct.id
          )
          SELECT id FROM category_tree
        )
      )
    `,
        {
          q,
          tsPrefix,
          qLike,
          status: ProductStatus.ACTIVE,
        },
      );


    if (minPrice) {
      qb.andWhere('product.price >= :minPrice', { minPrice: minPrice * 100 });
    }
    if (maxPrice) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: maxPrice * 100 });
    }
    if (country) {
      qb.andWhere('store.address_country ILIKE :country', {
        country: `%${country}%`,
      });
    }
    if (state) {
      qb.andWhere('store.address_state ILIKE :state', {
        state: `%${state}%`,
      });
    }
    if (city) {
      qb.andWhere('store.address_city ILIKE :city', {
        city: `%${city}%`,
      });
    }
    if (inStock) {
      qb.andWhere('product.stock > 0');
    }
    if (rating) {
      qb.andWhere('product.rating_average >= :rating', { rating });
    }

    // Dynamically apply variant filters
    Object.entries(filter).forEach(([key, values], idx) => {
      if (!values || values.length === 0) return;
      values.forEach((val, vIdx) => {
        qb.andWhere(
          `EXISTS (
            SELECT 1 FROM product_variants pv
            WHERE pv.product_id = product.id
            AND pv.combinations->>:key${idx} ILIKE :val${idx}_${vIdx}
          )`,
          { [`key${idx}`]: key, [`val${idx}_${vIdx}`]: val },
        );
      });
    });
    qb.orderBy('rank', 'DESC')
      .addOrderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [products, total] = await qb.getManyAndCount();

    const items = products.map((p) =>
      mapToProductCardData(p, {
        wishlistSet,
        extra: {
          category: p.category_ref?.name,
        },
      }),
    );

    // Aggregate available filter options from variant combinations
    // across all matched products so the frontend can build dynamic sidebar filters.
    const filtersMap = new Map<string, Set<string>>();
    for (const item of items) {
      const variants: { combinations?: Record<string, string> }[] =
        (item as any).variants ?? [];
      for (const v of variants) {
        if (!v.combinations) continue;
        for (const [key, val] of Object.entries(v.combinations)) {
          if (!filtersMap.has(key)) filtersMap.set(key, new Set());
          filtersMap.get(key)!.add(val);
        }
      }
    }

    const filters: Record<string, string[]> = {};
    for (const [key, vals] of filtersMap.entries()) {
      filters[key] = Array.from(vals).sort();
    }

    return {
      message: 'Search results retrieved successfully',
      data: {
        ...buildPagination(items, total, page, limit),
        filters,
      },
    };
  }

  async searchStoreProducts(
    storeId: string,
    params: ProductSearchDto,
    userId?: string,
  ) {
    const {
      q,
      page = 1,
      limit = 20,
      minPrice,
      maxPrice,
      rating,
      inStock = true,
      filter = {},
    } = params;

    if (!q?.trim()) {
      throw new BadRequestException('Search query is required');
    }

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const tsQuery = q
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `${w}:*`)
      .join(' & ');

    const qb = addProductCardSelects(
      this.productRepo.createQueryBuilder('product'),
      { withStore: true },
    )
      .addSelect(
        `ts_rank(product.search_vector, to_tsquery('english', :tsQuery))`,
        'rank',
      )
      .where(`product.search_vector @@ to_tsquery('english', :tsQuery)`, {
        tsQuery,
      })
      .andWhere('product.store_id = :storeId', { storeId })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      });

    if (minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: minPrice * 100 });
    }
    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: maxPrice * 100 });
    }
    if (rating !== undefined) {
      qb.andWhere('product.rating_average >= :rating', { rating });
    }
    if (inStock === true || (inStock as any) === 'true') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: false });
    } else if (inStock === false || (inStock as any) === 'false') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: true });
    }

    // Dynamically apply variant filters
    Object.entries(filter).forEach(([key, values], idx) => {
      if (!values || values.length === 0) return;
      values.forEach((val, vIdx) => {
        qb.andWhere(
          `EXISTS (
            SELECT 1 FROM product_variants pv
            WHERE pv.product_id = product.id
            AND pv.combinations->>:svKey${idx} ILIKE :svVal${idx}_${vIdx}
          )`,
          { [`svKey${idx}`]: key, [`svVal${idx}_${vIdx}`]: val },
        );
      });
    });

    const [products, total] = await qb
      .orderBy('rank', 'DESC')
      .addOrderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = products.map((p) =>
      mapToProductCardData(p, {
        wishlistSet,
      }),
    );

    return {
      message: 'Store search results',
      data: buildPagination(items, total, page, limit),
    };
  }

  async searchStoreProductsEntity(
    storeId: string,
    params: ProductSearchDto,
    pagination: PaginationQueryDto = { page: 1, limit: 20 },
  ) {
    const {
      q,
      minPrice,
      maxPrice,
      rating,
      inStock = true,
    } = params;

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    if (!q?.trim()) {
      throw new BadRequestException('Search query is required');
    }

    const tsQuery = q
      .trim()
      .replace(/[^a-zA-Z0-9\s]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `${w}:*`)
      .join(' & ');

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category_ref', 'category')
      .leftJoinAndSelect('product.store', 'store')
      .leftJoinAndSelect('product.variants', 'variants')
      .where(`product.search_vector @@ to_tsquery('english', :tsQuery)`, {
        tsQuery,
      })
      .andWhere('product.store_id = :storeId', { storeId })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      });

    if (minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: minPrice * 100 });
    }
    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: maxPrice * 100 });
    }
    if (rating !== undefined) {
      qb.andWhere('product.rating_average >= :rating', { rating });
    }
    if (inStock === true || (inStock as any) === 'true') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: false });
    } else if (inStock === false || (inStock as any) === 'false') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: true });
    }



    const [products, total] = await qb
      .orderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = products.map((product) => {
      const { category_ref, store, ...rest } = product;
      return {
        ...rest,
        price: Number(product.price) / 100,
        discount_price: product.discount_price
          ? Number(product.discount_price) / 100
          : null,
        category_ref,
        store_slug: store?.slug,
        store_name: store?.store_name,
        address_city: store?.address_city,
        address_state: store?.address_state,
        address_country: store?.address_country,
        address_postal_code: store?.address_postal_code,

        options: product.options || [],
        variants: (product.variants || []).map((v: any) => ({
          ...v,
          price: Number(v.price) / 100,
          discount_price: v.discount_price
            ? Number(v.discount_price) / 100
            : null,
        })),
      };
    });

    return {
      message: 'Store products search retrieved successfully',
      data: buildPagination(items, total, page, limit),
    };
  }

  async getVendorProducts(storeId: string, params: ProductSearchDto) {
    const {
      q,
      page = 1,
      limit = 20,
      minPrice,
      maxPrice,
      rating,
      inStock,
      isOutOfStock,
      onSale,
    } = params;

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category_ref', 'category')
      .leftJoinAndSelect('product.store', 'store')
      .leftJoinAndSelect('product.variants', 'variants')
      .where('product.store_id = :storeId', { storeId });

    if (q?.trim()) {
      const tsQuery = q
        .trim()
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => `${w}:*`)
        .join(' & ');

      qb.andWhere(`product.search_vector @@ to_tsquery('english', :tsQuery)`, {
        tsQuery,
      });
      qb.addSelect(
        `ts_rank(product.search_vector, to_tsquery('english', :tsQuery))`,
        'rank',
      );
      qb.orderBy('rank', 'DESC');
    } else {
      qb.orderBy('product.created_at', 'DESC');
    }

    if (minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: minPrice * 100 });
    }
    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: maxPrice * 100 });
    }
    if (rating !== undefined) {
      qb.andWhere('product.rating_average >= :rating', { rating });
    }

    const stockTrue = inStock === true || (inStock as any) === 'true';
    const stockFalse = inStock === false || (inStock as any) === 'false';

    if (stockTrue) {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: false });
    } else if (stockFalse) {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: true });
    }

    if (isOutOfStock !== undefined) {
      const oos = isOutOfStock === true || (isOutOfStock as any) === 'true';
      qb.andWhere('product.is_out_of_stock = :explicitOos', {
        explicitOos: oos,
      });
    }

    if (onSale !== undefined) {
      const saleTrue = onSale === true || (onSale as any) === 'true';
      const saleFalse = onSale === false || (onSale as any) === 'false';

      if (saleTrue) {
        qb.andWhere('product.on_sale = :onSaleTrue', { onSaleTrue: true });
      } else if (saleFalse) {
        qb.andWhere(
          '(product.on_sale = :onSaleFalse OR product.on_sale IS NULL)',
          {
            onSaleFalse: false,
          },
        );
      }
    }

    if (params.status) {
      qb.andWhere('product.status = :status', { status: params.status });
    }



    const [products, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = products.map((product) => {
      const { category_ref, store, ...rest } = product;
      return {
        ...rest,
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: Number(product.price) / 100,
        discount_price: product.discount_price
          ? Number(product.discount_price) / 100
          : null,
        stock: product.stock,
        tags: product.tags,
        image: product.image,
        gallery: product.gallery,
        highlights: product.highlights,
        specs: product.specs,

        shipping_note: product.shipping_note,
        returns_note: product.returns_note,
        status: product.status,
        options: product.options || [],
        variants: product.variants || [],
        rating_average: Number(product.rating_average),
        rating_count: product.rating_count,
        review_count: product.review_count,
        total_sold: product.total_sold,
        featured: product.featured,
        on_sale: product.on_sale,
        is_out_of_stock: product.is_out_of_stock,
        category_ref,
        store_slug: store?.slug,
        store_name: store?.store_name,
        created_at: product.created_at,
        updated_at: product.updated_at,
      };
    });

    return {
      message: 'Products retrieved successfully',
      data: buildPagination(items, total, page, limit),
    };
  }
}
