import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import slugify from 'slugify';

import {
  Product,
  ProductGalleryItem,
  ProductImage,
  ProductStatus,
} from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { UploadService } from 'src/common/services/upload.service';
import { PRODUCTS_GROUPED_BY_CATEGORY_SQL } from '../queries/products-grouped-by-category.sql';
import { ProductSearchDto } from '../dto/product-search.dto';
import { ProductCategory } from '../../product-category/entities/product-category.entity';
import { WishlistService } from '../../wishlist/wishlist.service';
import { normalizeJson } from 'src/utils/response/normalizeJson';
import { buildPagination } from 'src/utils/response/pagination.util';
import { CreateProductCloudinaryDto } from '../dto/create-product-cloudinary.dto';
import { ProductColor } from 'src/modules/shared-module/colors/entities/color.entity';
import { UpdateProductCloudinaryDto } from '../dto/update-product=coudinary.dto';
import { CartService } from '../../cart/cart.service';
// import { SetProductDeliveryRateDto } from '../dto/delivery-rate.dto';
// import { ProductDeliveryRate } from '../entities/product-delivery-rate.entity';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,

    @InjectRepository(ProductColor)
    private readonly colorRepo: Repository<ProductColor>,

    // @InjectRepository(ProductDeliveryRate)
    // private readonly deliveryRateRepo: Repository<ProductDeliveryRate>,

    private readonly upload: UploadService,
    private readonly wishlistService: WishlistService,
    private readonly cartService: CartService,
  ) {}

  private async resolveColorsForList(items: any[]) {
    const allColorIds = new Set<string>();
    items.forEach((item) => {
      if (Array.isArray(item.colors)) {
        item.colors.forEach((c: string) => allColorIds.add(c));
      }
    });

    if (allColorIds.size === 0) return items;

    const colors = await this.colorRepo.find({
      where: { id: In([...allColorIds]) },
      select: ['id', 'name', 'hex'],
    });

    const colorMap = new Map(colors.map((c) => [c.id, c]));

    return items.map((item) => ({
      ...item,
      colors: Array.isArray(item.colors)
        ? item.colors.map((id: string) => colorMap.get(id)).filter(Boolean)
        : [],
    }));
  }

  private async ensureCategoryExists(categoryId: string) {
    const exists = await this.categoryRepo.exist({
      where: { id: categoryId },
    });

    if (!exists) {
      throw new BadRequestException('Invalid category_id');
    }
  }

  // private async createDeliveryRates(
  //   productId: string,
  //   rates?: SetProductDeliveryRateDto[],
  // ) {
  //   if (!rates?.length) return;

  //   const entities = rates.map((rate) =>
  //     this.deliveryRateRepo.create({
  //       product_id: productId,
  //       country: rate.country,
  //       state: rate.state ?? null,
  //       city: rate.city ?? null,
  //       price: rate.price,
  //       estimated_days: rate.estimated_days ?? null,
  //     }),
  //   );

  //   await this.deliveryRateRepo.save(entities);
  // }

  /* ────────────────────────────────────────────────
     1️⃣ CATEGORIES WITH LIMITED PRODUCTS (20 MAX)
  ──────────────────────────────────────────────── */
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

    const enrichedRows = await this.resolveColorsForList(rows);

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
        stock: row.stock,
        rating_average: Number(row.rating_average),
        store_name: row.store_name,
        address_city: row.address_city,
        address_state: row.address_state,
        address_country: row.address_country,
        address_postal_code: row.address_postal_code,
        image: extractImageUrl(row.image),

        // ❤️ wishlist overlay
        is_in_wishlist: wishlistSet.has(row.id),

        // 🛍️ variants
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
      message: 'Categories with products retrieved successfully',
      data,
    };
  }

  /* ────────────────────────────────────────────────
   FEATURED PRODUCTS
─────────────────────────────────────────────── */
  async getFeaturedProducts(
    pagination: PaginationQueryDto = { limit: 20 },
    userId?: string,
  ) {
    const limit = pagination.limit ?? 20;

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    const products = await this.productRepo
      .createQueryBuilder('product')
      .leftJoin('product.category_ref', 'category')
      .leftJoin('product.store', 'store')
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.price',
        'product.discount_price',
        'product.stock',
        'product.image',
        'product.rating_average',
        'product.created_at',
        'product.colors',
        'product.sizes',
        'store.store_name',
        'store.slug',
        'store.address_city',
        'store.address_state',
        'store.address_country',
        'category.name',
      ])
      .where('product.featured = :featured', { featured: true })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })

      .orderBy('product.created_at', 'DESC')
      .limit(limit)
      .getRawMany();

    const items = products.map((p) => ({
      id: p.product_id,
      name: p.product_name,
      slug: p.product_slug,
      price: p.product_price,
      discount_price: p.product_discount_price,
      stock: p.product_stock,
      rating_average: p.product_rating_average,
      image: p.product_image?.url ?? null,
      store_name: p.store_store_name,
      store_slug: p.store_slug, // Mapped store.slug
      address_city: p.store_address_city,
      address_state: p.store_address_state,
      address_country: p.store_address_country,
      category: p.category_name,

      // ❤️ ADD THIS (only addition)
      is_in_wishlist: wishlistSet.has(p.product_id),
      colors: p.product_colors || [],
      sizes: p.product_sizes || [],
    }));

    const enriched = await this.resolveColorsForList(items);

    return {
      message: 'Featured products retrieved successfully',
      data: enriched,
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
      : new Set();

    const [products, total] = await this.productRepo
      .createQueryBuilder('product')
      .leftJoin('product.category_ref', 'category')
      .leftJoin('product.store', 'store')
      .where('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.price',
        'product.image',
        'product.rating_average',
        'product.stock', // ✅ ADD THIS
        'product.created_at', // ✅ REQUIRED for orderBy
        'product.colors',
        'product.sizes',
        'product.discount_price',

        'category.id',
        'category.name',
        'category.slug',

        'store.id',
        'store.store_name',
        'store.address_city',
        'store.address_state',
        'store.address_country',
        'store.address_postal_code',
      ])
      .orderBy('product.created_at', 'DESC')
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
      colors: p.colors || [],
      sizes: p.sizes || [],
      discount_price: p.discount_price ? Number(p.discount_price) : null,
      category: p.category_ref?.name,
    }));

    const items = await this.resolveColorsForList(data);

    return {
      message: 'Products retrieved successfully',
      data: buildPagination(items, total, page, limit),
    };
  }

  /* ────────────────────────────────────────────────
     3️⃣ PRODUCTS BY SINGLE CATEGORY
  ──────────────────────────────────────────────── */
  async getProductsByCategory(
    identifier: string,
    pagination: PaginationQueryDto = { page: 1, limit: 20 },
    userId?: string,
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    // 1️⃣ Resolve category (by id or slug)
    const category = await this.categoryRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      select: ['id', 'name', 'slug'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    // ❤️ Fetch wishlist IDs once
    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    // 2️⃣ Fetch products (same shape as getAllProducts)
    const [products, total] = await this.productRepo
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

        'store.id',
        'store.store_name',
        'store.slug',
        'store.address_city',
        'store.address_state',
        'store.address_country',
        'store.address_postal_code',
      ])
      .where('product.category_id = :categoryId', { categoryId: category.id })
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      })

      .orderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    // 3️⃣ Shape response (MATCH getAllProducts)
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
    }));

    const items = await this.resolveColorsForList(data);

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
      relations: ['category_ref', 'store', 'reviews', 'reviews.user'],
      order: {
        reviews: {
          created_at: 'DESC',
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // ❤️ Fetch wishlist IDs once
    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set<string>();

    /* ─────────────────────────────────────────────
     RESOLVE COLORS (DO NOT MUTATE product)
  ───────────────────────────────────────────── */
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

    /* ─────────────────────────────────────────────
     STORE SUMMARY
  ───────────────────────────────────────────── */
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

    /* ─────────────────────────────────────────────
     REVIEWS SUMMARY
  ───────────────────────────────────────────── */
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

    /* ─────────────────────────────────────────────
     RELATED PRODUCTS
  ───────────────────────────────────────────── */
    const related = await this.productRepo
      .createQueryBuilder('p')
      .leftJoin('p.store', 'store')
      .leftJoin('p.category_ref', 'category')
      .select([
        'p.id',
        'p.name',
        'p.slug',
        'p.price',
        'p.discount_price',
        'p.rating_average',
        'p.stock',
        'p.image',
        'p.colors',
        'p.sizes',
        'store.store_name',
        'store.address_city',
        'store.address_state',
        'store.address_country',
        'category.name',
      ])
      .where('p.category_id = :categoryId', {
        categoryId: product.category_id,
      })
      .andWhere('p.id != :currentId', {
        currentId: product.id,
      })
      .orderBy('p.total_sold', 'DESC')
      .addOrderBy('p.created_at', 'DESC')
      .limit(10)
      .getRawMany();

    const related_products = related.map((p) => ({
      id: p.p_id,
      name: p.p_name,
      slug: p.p_slug,
      price: Number(p.p_price),
      discount_price: p.p_discount_price ? Number(p.p_discount_price) : null,
      stock: p.p_stock,
      rating_average: Number(p.p_rating_average),
      image: p.p_image?.url ?? null,
      colors: p.p_colors || [],
      sizes: p.p_sizes || [],
      store_name: p.store_store_name,
      store_slug: p.store_slug,
      address_city: p.store_address_city,
      address_state: p.store_address_state,
      address_country: p.store_address_country,
      category: p.category_name,
      is_in_wishlist: wishlistSet.has(p.p_id),
    }));

    const enriched_related = await this.resolveColorsForList(related_products);

    /* ─────────────────────────────────────────────
     RESPONSE PRODUCT (SAFE COPY)
  ───────────────────────────────────────────── */
    const { store: _s, reviews: _r, ...productOnly } = product;

    productOnly.specs = normalizeJson(productOnly.specs);

    return {
      message: 'Product retrieved successfully',

      // 🔒 INTERNAL USAGE — UNTOUCHED ENTITY
      product,

      // 🌐 API RESPONSE — ENRICHED
      data: {
        product: {
          ...productOnly,
          colors: resolvedColors, // ✅ hydrated colors here ONLY
          is_in_wishlist: wishlistSet.has(product.id),
        },
        store,
        reviews,
        related_products: enriched_related,
      },
    };
  }

  /* ────────────────────────────────────────────────
     GET PRODUCTS BY STORE
  ──────────────────────────────────────────────── */
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
      relations: ['category_ref', 'store'],
    });

    const items = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      discount_price: p.discount_price ? Number(p.discount_price) : null,
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
    }));

    const enriched = await this.resolveColorsForList(items);

    return {
      message: 'Store products retrieved successfully',
      data: buildPagination(enriched, total, page, limit),
    };
  }
  /* ────────────────────────────────────────────────
   UPDATE PRODUCT STATUS (ACTIVE / INACTIVE)
──────────────────────────────────────────────── */
  async updateStatus(productId: string, status: ProductStatus) {
    if (!Object.values(ProductStatus).includes(status)) {
      throw new BadRequestException('Invalid product status');
    }

    const product = await this.productRepo.findOne({
      where: { id: productId },
      select: ['id', 'status'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.status === status) {
      return {
        message: `Product already ${status}`,
        status,
      };
    }

    product.status = status;

    await this.productRepo.save(product);

    return {
      message:
        status === ProductStatus.ACTIVE
          ? 'Product activated successfully'
          : 'Product deactivated successfully',
      status,
    };
  }
  async updateOnSale(productId: string, onSale: boolean) {
    if (typeof onSale !== 'boolean') {
      throw new BadRequestException('Invalid on_sale value');
    }

    const product = await this.productRepo.findOne({
      where: { id: productId },
      select: ['id', 'on_sale', 'discount_price'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // ❌ Prevent on_sale without discount
    if (onSale === true && product.discount_price == null) {
      throw new BadRequestException(
        'Cannot mark product as on sale without a discount price',
      );
    }

    if (product.on_sale === onSale) {
      return {
        message: `Product already ${onSale ? 'on sale' : 'not on sale'}`,
        on_sale: onSale,
      };
    }

    product.on_sale = onSale;

    await this.productRepo.save(product);

    return {
      message: onSale
        ? 'Product marked as on sale successfully'
        : 'Product removed from sale successfully',
      on_sale: onSale,
    };
  }

  /* ────────────────────────────────────────────────
     SEARCH PRODUCTS
  ──────────────────────────────────────────────── */
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
      inStock = true,
      colors,
      sizes,
    } = params;

    if (!q?.trim()) {
      throw new BadRequestException('Search query is required');
    }

    const wishlistSet = userId
      ? await this.wishlistService.getWishlistProductIds(userId)
      : new Set();

    /* ---------- FULL TEXT QUERY ---------- */
    const tsQuery = q
      .trim()
      .split(/\s+/)
      .map((w) => `${w}:*`)
      .join(' & ');

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoin('product.category_ref', 'category')
      .leftJoin('product.store', 'store')
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.price',
        'product.image',
        'product.rating_average',
        'product.stock',
        'category.name',
        'store.address_country',
        'store.address_state',
        'store.address_city',
        'store.slug',
        'store.address_postal_code',
        'store.store_name',
        'product.featured',
        'product.created_at',
        'product.colors',
        'product.sizes',
      ])
      .addSelect(
        `ts_rank(product.search_vector, to_tsquery('english', :tsQuery))`,
        'rank',
      )
      .where(`product.search_vector @@ to_tsquery('english', :tsQuery)`, {
        tsQuery,
      });

    /* ---------- PRICE ---------- */
    if (minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    /* ---------- LOCATION ---------- */
    if (country) qb.andWhere('store.address_country = :country', { country });
    if (state) qb.andWhere('store.address_state = :state', { state });
    if (city) qb.andWhere('store.address_city = :city', { city });

    /* ---------- RATING ---------- */
    if (rating !== undefined) {
      qb.andWhere('product.rating_average >= :rating', { rating });
    }

    /* ---------- STOCK ---------- */
    if (inStock === true) {
      qb.andWhere('product.stock > 0');
    }

    /* ---------- COLORS ---------- */
    if (colors?.length) {
      qb.andWhere('product.colors && :colors', { colors });
    }

    /* ---------- SIZES ---------- */
    if (sizes?.length) {
      qb.andWhere('product.sizes && :sizes', { sizes });
    }

    /* ---------- EXECUTION ---------- */
    const [products, total] = await qb
      .orderBy('rank', 'DESC')
      .addOrderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    /* ---------- SANITIZE ---------- */
    const items = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      image: p.image?.url ?? null,
      rating_average: Number(p.rating_average ?? 0),
      stock: p.stock,
      store_name: p.store?.store_name,
      store_slug: p.store?.slug,
      address_city: p.store?.address_city,
      address_state: p.store?.address_state,
      address_country: p.store?.address_country,
      address_postal_code: p.store?.address_postal_code,
      discount_price: p.discount_price ? Number(p.discount_price) : null,
      is_featured: p.featured,
      is_in_wishlist: wishlistSet.has(p.id),
      category: p.category_ref?.name,
      colors: p.colors || [],
      sizes: p.sizes || [],
    }));

    const enriched = await this.resolveColorsForList(items);

    return {
      message: 'Search results',
      data: buildPagination(enriched, total, page, limit),
    };
  }
  /* ────────────────────────────────────────────────
   SEARCH PRODUCTS FOR A SPECIFIC STORE
─────────────────────────────────────────────── */
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

    /* ---------- FULL TEXT QUERY ---------- */
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
      // 🔒 STORE SCOPE
      .andWhere('product.store_id = :storeId', { storeId })
      // 🔒 ONLY ACTIVE PRODUCTS
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      });

    /* ---------- PRICE ---------- */
    if (minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice });
    }
    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    /* ---------- RATING ---------- */
    if (rating !== undefined) {
      qb.andWhere('product.rating_average >= :rating', { rating });
    }

    /* ---------- STOCK ---------- */
    if (inStock === true || (inStock as any) === 'true') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: false });
    } else if (inStock === false || (inStock as any) === 'false') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: true });
    }

    /* ---------- COLORS ---------- */
    if (colors?.length) {
      qb.andWhere('product.colors && :colors', { colors });
    }

    /* ---------- SIZES ---------- */
    if (sizes?.length) {
      qb.andWhere('product.sizes && :sizes', { sizes });
    }

    /* ---------- EXECUTION ---------- */
    const [products, total] = await qb
      .orderBy('rank', 'DESC')
      .addOrderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    /* ---------- SHAPE RESPONSE ---------- */
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
      is_out_of_stock: p.is_out_of_stock,
    }));

    const enriched = await this.resolveColorsForList(items);

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

    /* ---------- FULL TEXT QUERY ---------- */
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
      // 🔒 STORE SCOPE
      .andWhere('product.store_id = :storeId', { storeId })
      // 🔒 ONLY ACTIVE PRODUCTS
      .andWhere('product.status = :status', {
        status: ProductStatus.ACTIVE,
      });

    /* ---------- PRICE ---------- */
    if (minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    /* ---------- RATING ---------- */
    if (rating !== undefined) {
      qb.andWhere('product.rating_average >= :rating', { rating });
    }

    /* ---------- STOCK ---------- */
    if (inStock === true || (inStock as any) === 'true') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: false });
    } else if (inStock === false || (inStock as any) === 'false') {
      qb.andWhere('product.is_out_of_stock = :oos', { oos: true });
    }

    /* ---------- COLORS ---------- */
    if (colors?.length) {
      qb.andWhere('product.colors && :colors', { colors });
    }

    /* ---------- SIZES ---------- */
    if (sizes?.length) {
      qb.andWhere('product.sizes && :sizes', { sizes });
    }

    /* ---------- EXECUTION ---------- */
    const [products, total] = await qb
      .orderBy('product.created_at', 'DESC') // ✅ SIMPLE & SAFE
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    /* ---------- SHAPE RESPONSE ---------- */
    const items = products.map((product) => {
      const { category_ref, store, ...rest } = product;
      return {
        ...rest,
        category_ref,
        store_name: store?.store_name,
        address_city: store?.address_city,
        address_state: store?.address_state,
        address_country: store?.address_country,
        address_postal_code: store?.address_postal_code,
        colors: product.colors || [],
        sizes: product.sizes || [],
        discount_price: product.discount_price
          ? Number(product.discount_price)
          : null,
      };
    });

    const enriched = await this.resolveColorsForList(items);

    return {
      message: 'Store products search retrieved successfully',
      data: buildPagination(enriched, total, page, limit),
    };
  }

  /* ────────────────────────────────────────────────
     🔍 UNIFIED: GET / SEARCH VENDOR PRODUCTS
  ──────────────────────────────────────────────── */
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

    /* ---------- FULL TEXT QUERY (OPTIONAL) ---------- */
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

    /* ---------- FILTERS ---------- */
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

    /* ---------- ON SALE (ROBUST BOOLEAN CHECK) ---------- */
    if (onSale !== undefined) {
      const saleTrue = onSale === true || (onSale as any) === 'true';
      const saleFalse = onSale === false || (onSale as any) === 'false';

      if (saleTrue) {
        qb.andWhere('product.on_sale = :onSaleTrue', { onSaleTrue: true });
      } else if (saleFalse) {
        // Handle NULL as false
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

    /* ---------- COLORS & SIZES ---------- */
    if (colors?.length) {
      qb.andWhere('product.colors && :colors', { colors });
    }

    if (sizes?.length) {
      qb.andWhere('product.sizes && :sizes', { sizes });
    }

    /* ---------- EXECUTION ---------- */
    const [products, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    /* ---------- SHAPE RESPONSE ---------- */
    const items = products.map((product) => {
      const { category_ref, store, ...rest } = product;
      return {
        ...rest,
        id: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        price: Number(product.price),
        discount_price: product.discount_price
          ? Number(product.discount_price)
          : null,
        stock: product.stock,
        tags: product.tags,
        image: product.image, // Object { url, public_id }
        gallery: product.gallery,
        highlights: product.highlights,
        specs: product.specs,
        colors: product.colors,
        sizes: product.sizes,
        shipping_note: product.shipping_note,
        returns_note: product.returns_note,
        status: product.status,
        shipping_cost: Number(product.shipping_cost),
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

  /* ────────────────────────────────────────────────
     CREATE PRODUCT
  ──────────────────────────────────────────────── */
  async create(
    user: { sub: string; store_id: string | null },
    dto: CreateProductDto,
    files?: {
      image?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
    },
  ) {
    if (!user.store_id) {
      throw new BadRequestException('Vendor does not have a store');
    }

    if (!dto.name || typeof dto.name !== 'string') {
      throw new BadRequestException('Product name is required');
    }

    await this.ensureCategoryExists(dto.category_id);

    const slug = slugify(dto.name, { lower: true, strict: true });

    const exists = await this.productRepo.exists({ where: { slug } });
    if (exists) {
      throw new BadRequestException('Product with same name exists');
    }

    /* ────────────────────────────────────────────────
     MAIN IMAGE
  ──────────────────────────────────────────────── */
    let image: ProductImage | null = null;

    if (files?.image?.[0]) {
      image = await this.upload.uploadSingle(
        files.image[0],
        'easystore/products/main',
      );
    }

    /* ────────────────────────────────────────────────
     GALLERY IMAGES (PARALLEL)
  ──────────────────────────────────────────────── */
    let gallery: ProductGalleryItem[] | null = null;

    if (files?.gallery?.length) {
      gallery = await this.upload.uploadMultiple(
        files.gallery,
        'easystore/products/gallery',
      );
    }

    /* ────────────────────────────────────────────────
     CREATE PRODUCT (SECURE IDS)
  ──────────────────────────────────────────────── */
    const product = this.productRepo.create({
      ...dto,

      // 🔐 enforced from JWT
      vendor_id: user.sub,
      store_id: user.store_id,

      slug,
      image,
      gallery,
    });

    const saved = await this.productRepo.save(product);
    return {
      message: 'Product created successfully',
      product: saved,
    };
  }

  /* ────────────────────────────────────────────────
   CREATE PRODUCT (CLOUDINARY DIRECT UPLOAD)
   No files handled by backend
─────────────────────────────────────────────── */
  async createWithCloudinary(
    user: { sub: string; store_id: string | null },
    dto: CreateProductCloudinaryDto,
  ) {
    if (!user.store_id) {
      throw new BadRequestException('Vendor does not have a store');
    }

    await this.ensureCategoryExists(dto.category_id);

    const slug = slugify(dto.name, { lower: true, strict: true });

    const exists = await this.productRepo.exist({ where: { slug } });
    if (exists) {
      throw new BadRequestException('Product with same name exists');
    }

    const product = this.productRepo.create({
      ...dto,

      vendor_id: user.sub,
      store_id: user.store_id,
      slug,

      image: dto.image ?? null,
      gallery: dto.gallery ?? null,

      status: ProductStatus.ACTIVE,
    });

    const saved = await this.productRepo.save(product);
    // await this.createDeliveryRates(saved.id, dto.delivery_rates);

    return {
      message: 'Product created successfully',
      product: saved,
    };
  }

  async createMany(
    user: { sub: string; store_id: string | null },
    dtos: CreateProductDto[],
  ) {
    if (!user.store_id) {
      throw new BadRequestException('Vendor does not have a store');
    }

    if (!dtos.length) {
      throw new BadRequestException('No products provided');
    }

    /* ────────────────────────────────────────────────
     1️⃣ Generate slugs + detect duplicates in request
  ──────────────────────────────────────────────── */
    const slugs = dtos.map((dto) =>
      slugify(dto.name, { lower: true, strict: true }),
    );

    const duplicateSlugs = slugs.filter(
      (slug, index) => slugs.indexOf(slug) !== index,
    );

    if (duplicateSlugs.length) {
      throw new BadRequestException(
        `Duplicate product names in request: ${duplicateSlugs.join(', ')}`,
      );
    }

    /* ────────────────────────────────────────────────
     2️⃣ Check existing products in DB (single query)
  ──────────────────────────────────────────────── */
    const existing = await this.productRepo
      .createQueryBuilder('product')
      .where('product.slug IN (:...slugs)', { slugs })
      .select(['product.slug'])
      .getMany();

    if (existing.length) {
      throw new BadRequestException(
        `Products already exist: ${existing.map((p) => p.slug).join(', ')}`,
      );
    }

    /* ────────────────────────────────────────────────
     3️⃣ Create entities (SECURE IDS)
  ──────────────────────────────────────────────── */
    const products = this.productRepo.create(
      dtos.map((dto) => ({
        ...dto,

        // 🔐 enforced from JWT
        vendor_id: user.sub,
        store_id: user.store_id,

        slug: slugify(dto.name, { lower: true, strict: true }),
      })),
    );

    /* ────────────────────────────────────────────────
     4️⃣ Save in ONE DB call 🚀
  ──────────────────────────────────────────────── */
    const saved = await this.productRepo.save(products);

    return {
      message: 'Products created successfully',
      count: saved.length,
      products: saved,
    };
  }

  /* ────────────────────────────────────────────────
     UPDATE PRODUCT
  ──────────────────────────────────────────────── */
  async update(id: string, dto: UpdateProductDto) {
    const product = await this.productRepo.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.name && dto.name !== product.name) {
      product.slug = slugify(dto.name, { lower: true, strict: true });
    }

    Object.assign(product, dto);

    const updated = await this.productRepo.save(product);

    return {
      message: 'Product updated successfully',
      product: updated,
    };
  }

  async updateWithCloudinary(id: string, dto: UpdateProductCloudinaryDto) {
    const product = await this.productRepo.findOne({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    /* ─────────────────────────────────────────────
     CATEGORY CHECK (IF PROVIDED)
  ───────────────────────────────────────────── */
    if (dto.category_id && dto.category_id !== product.category_id) {
      await this.ensureCategoryExists(dto.category_id);
    }

    /* ─────────────────────────────────────────────
     SLUG UPDATE (ONLY IF NAME CHANGES)
  ───────────────────────────────────────────── */
    if (dto.name && dto.name !== product.name) {
      product.slug = slugify(dto.name, { lower: true, strict: true });
    }

    /* ─────────────────────────────────────────────
     CLOUDINARY MEDIA (SAFE OVERRIDES)
  ───────────────────────────────────────────── */
    if (dto.image !== undefined) {
      product.image = dto.image; // allow null to remove image
    }

    if (dto.gallery !== undefined) {
      product.gallery = dto.gallery; // allow null / empty array
    }

    /* ─────────────────────────────────────────────
     APPLY REMAINING FIELDS
  ───────────────────────────────────────────── */
    Object.assign(product, {
      ...dto,
      image: product.image,
      gallery: product.gallery,
    });

    const updated = await this.productRepo.save(product);

    return {
      message: 'Product updated successfully',
      product: updated,
    };
  }

  /* ────────────────────────────────────────────────
     DELETE PRODUCT
  ──────────────────────────────────────────────── */
  async remove(id: string) {
    const product = await this.productRepo.findOne({
      where: { id },
      select: ['id', 'image', 'gallery'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    /* ─────────────────────────────────────────────
     REMOVE FROM CARTS (JSONB)
  ───────────────────────────────────────────── */
    await this.cartService.removeProductFromAllCarts(id);

    /* ─────────────────────────────────────────────
     REMOVE FROM WISHLIST (EXPLICIT)
  ───────────────────────────────────────────── */
    await this.wishlistService.removeProductFromAllWishlists(id);

    /* ─────────────────────────────────────────────
     DELETE CLOUDINARY ASSETS FIRST
  ───────────────────────────────────────────── */

    // 🖼️ delete main image
    if (product.image?.public_id) {
      await this.upload.deleteSingle(product.image.public_id);
    }

    // 🖼️ delete gallery images
    if (product.gallery?.length) {
      await this.upload.deleteMultiple(product.gallery);
    }

    /* ─────────────────────────────────────────────
     DELETE PRODUCT FROM DB
  ───────────────────────────────────────────── */
    await this.productRepo.delete(id);

    return {
      message: 'Product and images deleted successfully',
    };
  }
}
