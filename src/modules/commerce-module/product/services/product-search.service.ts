import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product, ProductStatus } from '../entities/product.entity';
import { ProductSearchDto } from '../dto/product-search.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { WishlistService } from '../../wishlist/wishlist.service';
import { buildPagination } from 'src/utils/response/pagination.util';
import { ProductHelperService } from './product-helper.service';

@Injectable()
export class ProductSearchService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    private readonly wishlistService: WishlistService,
    private readonly helpers: ProductHelperService,
  ) {}

  async search(params: ProductSearchDto) {
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
      colors = [],
      sizes = [],
    } = params;

    if (!q?.trim()) {
      throw new BadRequestException('Search query is required');
    }

    let matchedColorIds: string[] = [];
    if (colors.length > 0) {
      matchedColorIds = await this.helpers.resolveColorIds(colors);
    }

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoin('product.category_ref', 'category')
      .leftJoin('product.store', 'store')
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.price',
        'product.discount_price',
        'product.on_sale',
        'product.stock',
        'product.image',
        'product.rating_average',
        'product.created_at',
        'product.colors',
        'product.sizes',
        'store.store_name',
        'store.address_city',
        'store.address_state',
        'store.address_country',
        'store.slug',
        'category.name',
      ])
      .addSelect(
        `
      (
        ts_rank(product.search_vector, websearch_to_tsquery(:q)) * 0.7
        + similarity(product.name, :q) * 0.5
        + similarity(category.name, :q) * 0.3
      )
    `,
        'rank',
      )
      .where(
        `
      product.status = :status
      AND (
        product.search_vector @@ websearch_to_tsquery(:q)
        OR similarity(product.name, :q) > 0.25
        OR product.category_id IN (
          WITH RECURSIVE category_tree AS (
            SELECT id
            FROM product_categories
            WHERE similarity(name, :q) > 0.25
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
    if (matchedColorIds.length > 0) {
      qb.andWhere('product.colors && :colorIds', {
        colorIds: matchedColorIds,
      });
    }
    if (sizes.length > 0) {
      qb.andWhere('product.sizes && :sizes', { sizes });
    }

    qb.orderBy('rank', 'DESC')
      .addOrderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [products, total] = await qb.getManyAndCount();

    const items = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      discount_price: p.discount_price ? Number(p.discount_price) : null,
      on_sale: p.on_sale,
      stock: p.stock,
      rating_average: Number(p.rating_average),
      image: p.image?.url ?? null,
      store_name: p.store?.store_name,
      store_slug: p.store?.slug,
      address_city: p.store?.address_city,
      address_state: p.store?.address_state,
      address_country: p.store?.address_country,
      category: p.category_ref?.name,
      colors: p.colors || [],
      sizes: p.sizes || [],
    }));

    const enriched = await this.helpers.resolveColorsForList(items);

    return {
      message: 'Search results retrieved successfully',
      data: buildPagination(enriched, total, page, limit),
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
      colors,
      sizes,
    } = params;

    if (!q?.trim()) {
      throw new BadRequestException('Search query is required');
    }

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const tsQuery = q
      .trim()
      .split(/\s+/)
      .map((w) => `${w}:*`)
      .join(' & ');

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoin('product.store', 'store')
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
        'product.is_out_of_stock',
        'store.id',
        'store.store_name',
        'store.address_city',
        'store.address_state',
        'store.address_country',
        'store.address_postal_code',
      ])
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
      qb.andWhere('product.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice });
    }
    if (rating !== undefined) {
      qb.andWhere('product.rating_average >= :rating', { rating });
    }
    if (inStock === true || (inStock as any) === 'true') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: false });
    } else if (inStock === false || (inStock as any) === 'false') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: true });
    }

    if (colors?.length) {
      const colorIds = await this.helpers.resolveColorIds(colors);
      if (colorIds.length > 0) {
        qb.andWhere('product.colors && :colorIds', { colorIds });
      } else {
        qb.andWhere('1=0');
      }
    }

    if (sizes?.length) {
      qb.andWhere('product.sizes && :sizes', { sizes });
    }

    const [products, total] = await qb
      .orderBy('rank', 'DESC')
      .addOrderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      image: p.image?.url ?? null,
      rating_average: Number(p.rating_average ?? 0),
      stock: p.stock,
      store_name: p.store?.store_name,
      address_city: p.store?.address_city,
      address_state: p.store?.address_state,
      address_country: p.store?.address_country,
      address_postal_code: p.store?.address_postal_code,
      is_in_wishlist: wishlistSet.has(p.id),
      colors: p.colors || [],
      sizes: p.sizes || [],
      discount_price: p.discount_price ? Number(p.discount_price) : null,
      on_sale: p.on_sale,
      is_out_of_stock: p.is_out_of_stock,
    }));

    const enriched = await this.helpers.resolveColorsForList(items);

    return {
      message: 'Store search results',
      data: buildPagination(enriched, total, page, limit),
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
      colors,
      sizes,
    } = params;

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    if (!q?.trim()) {
      throw new BadRequestException('Search query is required');
    }

    const tsQuery = q
      .trim()
      .split(/\s+/)
      .map((w) => `${w}:*`)
      .join(' & ');

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category_ref', 'category')
      .leftJoinAndSelect('product.store', 'store')
      .where(`product.search_vector @@ to_tsquery('english', :tsQuery)`, {
        tsQuery,
      })
      .andWhere('product.store_id = :storeId', { storeId })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      });

    if (minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice });
    }
    if (rating !== undefined) {
      qb.andWhere('product.rating_average >= :rating', { rating });
    }
    if (inStock === true || (inStock as any) === 'true') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: false });
    } else if (inStock === false || (inStock as any) === 'false') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: true });
    }

    if (colors?.length) {
      const colorIds = await this.helpers.resolveColorIds(colors);
      if (colorIds.length > 0) {
        qb.andWhere('product.colors && :colors', { colors: colorIds });
      } else {
        qb.andWhere('1=0');
      }
    }

    if (sizes?.length) {
      qb.andWhere('product.sizes && :sizes', { sizes });
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
        price: Number(product.price),
        discount_price: product.discount_price
          ? Number(product.discount_price)
          : null,
        shipping_cost: product.shipping_cost
          ? Number(product.shipping_cost)
          : null,
        category_ref,
        store_name: store?.store_name,
        address_city: store?.address_city,
        address_state: store?.address_state,
        address_country: store?.address_country,
        address_postal_code: store?.address_postal_code,
        colors: product.colors || [],
        sizes: product.sizes || [],
      };
    });

    const enriched = await this.helpers.resolveColorsForList(items);

    return {
      message: 'Store products search retrieved successfully',
      data: buildPagination(enriched, total, page, limit),
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
      colors,
      sizes,
    } = params;

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category_ref', 'category')
      .leftJoinAndSelect('product.store', 'store')
      .where('product.store_id = :storeId', { storeId });

    if (q?.trim()) {
      const tsQuery = q
        .trim()
        .split(/\s+/)
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
      qb.andWhere('product.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice });
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

    if (colors?.length) {
      const colorIds = await this.helpers.resolveColorIds(colors);
      if (colorIds.length > 0) {
        qb.andWhere('product.colors && :colors', { colors: colorIds });
      } else {
        qb.andWhere('1=0');
      }
    }

    if (sizes?.length) {
      qb.andWhere('product.sizes && :sizes', { sizes });
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
        colors: product.colors,
        sizes: product.sizes,
        shipping_note: product.shipping_note,
        returns_note: product.returns_note,
        status: product.status,
        shipping_cost: Number(product.shipping_cost) / 100,
        rating_average: Number(product.rating_average),
        rating_count: product.rating_count,
        review_count: product.review_count,
        total_sold: product.total_sold,
        featured: product.featured,
        on_sale: product.on_sale,
        is_out_of_stock: product.is_out_of_stock,
        category_ref,
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
