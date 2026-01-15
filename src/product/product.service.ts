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
} from './entities/product.entity';
import { ProductCategory } from 'src/product-category/entities/product-category.entity';
import { Store } from 'src/store/entities/store.entity';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { buildPagination } from 'src/common/utils/response/pagination.util';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { UploadService } from 'src/common/services/upload.service';
import { PRODUCTS_GROUPED_BY_CATEGORY_SQL } from './queries/products-grouped-by-category.sql';
import { normalizeJson } from 'src/utils/normalizeJson';
import { WishlistService } from 'src/wishlist/wishlist.service';
import { ProductSearchDto } from './dto/product-search.dto';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,

    private readonly upload: UploadService,
    private readonly wishlistService: WishlistService,
  ) {}

  private async ensureCategoryExists(categoryId: string) {
    const exists = await this.categoryRepo.exist({
      where: { id: categoryId },
    });

    if (!exists) {
      throw new BadRequestException('Invalid category_id');
    }
  }

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

    const grouped = new Map<string, any[]>();

    for (const row of rows) {
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
        image: extractImageUrl(row.image),

        // ❤️ wishlist overlay
        is_in_wishlist: wishlistSet.has(row.id),
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
        'store.store_name',
      ])
      .where('product.featured = :featured', { featured: true })
      .orderBy('product.created_at', 'DESC')
      .limit(limit)
      .getRawMany();

    return {
      message: 'Featured products retrieved successfully',
      data: products.map((p) => ({
        id: p.product_id,
        name: p.product_name,
        slug: p.product_slug,
        price: p.product_price,
        discount_price: p.product_discount_price,
        stock: p.product_stock,
        rating_average: p.product_rating_average,
        image: p.product_image?.url ?? null,
        store_name: p.store_store_name,

        // ❤️ ADD THIS (only addition)
        is_in_wishlist: wishlistSet.has(p.product_id),
      })),
    };
  }

  /* ────────────────────────────────────────────────
     2️⃣ ALL PRODUCTS (FLAT LIST)
  ──────────────────────────────────────────────── */
  // async getAllProducts(
  //   pagination: PaginationQueryDto = { page: 1, limit: 20 },
  // ) {
  //   const page = pagination.page ?? 1;
  //   const limit = pagination.limit ?? 20;

  //   const qb = this.productRepo
  //     .createQueryBuilder('product')
  //     .leftJoin('product.category_ref', 'category')
  //     .select([
  //       'product.id',
  //       'product.name',
  //       'product.slug',
  //       'product.price',
  //       'product.discount_price',
  //       'product.stock',
  //       'product.rating_average',
  //       'product.image',
  //       'product.created_at',

  //       'category.id',
  //       'category.name',
  //       'category.slug',
  //     ])
  //     .orderBy('product.created_at', 'DESC')
  //     .skip((page - 1) * limit)
  //     .take(limit);

  //   const [products, total] = await qb.getManyAndCount();

  //   const data = products.map((p) => ({
  //     id: p.id,
  //     name: p.name,
  //     slug: p.slug,
  //     price: Number(p.price),
  //     discount_price: p.discount_price ? Number(p.discount_price) : null,
  //     stock: p.stock,
  //     rating_average: Number(p.rating_average),
  //     image: p.image?.url ?? null, // ✅ URL only
  //     category: p.category_ref
  //       ? {
  //           id: p.category_ref.id,
  //           name: p.category_ref.name,
  //           slug: p.category_ref.slug,
  //         }
  //       : null,
  //   }));

  //   return {
  //     message: 'Products retrieved successfully',
  //     data: buildPagination(data, total, page, limit),
  //   };
  // }

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
      .select([
        'product.id',
        'product.name',
        'product.slug',
        'product.price',
        'product.image',
        'product.rating_average',
        'product.stock', // ✅ ADD THIS
        'product.created_at', // ✅ REQUIRED for orderBy

        'category.id',
        'category.name',
        'category.slug',
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
      stock: p.stock, // ✅ EXPOSE IT
      is_in_wishlist: wishlistSet.has(p.id),
    }));

    return {
      message: 'Products retrieved successfully',
      data: buildPagination(data, total, page, limit),
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

    const [products, total] = await this.productRepo.findAndCount({
      where: { category_id: category.id },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    // ❤️ Overlay wishlist flag
    const data = products.map((p) => ({
      ...p,
      is_in_wishlist: wishlistSet.has(p.id),
    }));

    return {
      message: 'Category products retrieved successfully',
      category,
      data: buildPagination(data, total, page, limit),
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

    // STORE SUMMARY
    const store = product.store
      ? {
          id: product.store.id,
          store_name: product.store.store_name,
          slug: product.store.slug,
          rating_average: product.store.rating_average,
          rating_count: product.store.rating_count,
          logo: product.store.logo,
        }
      : null;

    // REVIEWS SUMMARY
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

    // RELATED PRODUCTS
    const related = await this.productRepo
      .createQueryBuilder('p')
      .leftJoin('p.store', 'store')
      .select([
        'p.id',
        'p.name',
        'p.slug',
        'p.price',
        'p.discount_price',
        'p.rating_average',
        'p.stock',
        'p.image',
        'store.store_name',
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
      store_name: p.store_store_name,

      // ❤️ wishlist flag
      is_in_wishlist: wishlistSet.has(p.p_id),
    }));

    const { store: _s, reviews: _r, ...productOnly } = product;

    // ✅ FIX specs ONLY
    productOnly.specs = normalizeJson(productOnly.specs);

    return {
      message: 'Product retrieved successfully',
      product,
      data: {
        product: {
          ...productOnly,
          // ❤️ wishlist flag for main product
          is_in_wishlist: wishlistSet.has(product.id),
        },
        store,
        reviews,
        related_products,
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
      relations: ['category_ref'],
    });

    return {
      message: 'Store products retrieved successfully',
      data: buildPagination(products, total, page, limit),
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

    const qb = this.productRepo.createQueryBuilder('product');

    /* -------- TEXT SEARCH -------- */
    qb.where(`(product.name ILIKE :q OR product.description ILIKE :q)`, {
      q: `%${q}%`,
    });

    /* -------- PRICE -------- */
    if (minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice });
    }

    if (maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice });
    }

    /* -------- LOCATION -------- */
    if (country) {
      qb.andWhere('product.country = :country', { country });
    }

    if (state) {
      qb.andWhere('product.state = :state', { state });
    }

    if (city) {
      qb.andWhere('product.city ILIKE :city', { city: `%${city}%` });
    }

    /* -------- RATING -------- */
    if (rating !== undefined) {
      qb.andWhere('product.rating_average >= :rating', { rating });
    }

    /* -------- STOCK -------- */
    if (inStock === true) {
      qb.andWhere('product.stock > 0');
    }

    /* -------- COLORS -------- */
    if (colors?.length) {
      qb.andWhere('product.colors && ARRAY[:...colors]', { colors });
    }

    /* -------- SIZES -------- */
    if (sizes?.length) {
      qb.andWhere('product.sizes && ARRAY[:...sizes]', { sizes });
    }

    /* -------- EXECUTION -------- */
    const [products, total] = await qb
      .orderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    /* -------- SANITIZE -------- */
    const items = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      image: p.image?.url ?? null,
      rating_average: Number(p.rating_average ?? 0),
      stock: p.stock,

      location: {
        country: p.country,
        state: p.state,
        city: p.city,
      },

      is_featured: Boolean(p.featured),
      is_in_wishlist: wishlistSet.has(p.id),
    }));

    return {
      message: 'Search results',
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

  /* ────────────────────────────────────────────────
     DELETE PRODUCT
  ──────────────────────────────────────────────── */
  async remove(id: string) {
    const exists = await this.productRepo.exist({ where: { id } });
    if (!exists) {
      throw new NotFoundException('Product not found');
    }

    await this.productRepo.delete(id);

    return {
      message: 'Product deleted successfully',
    };
  }
}
