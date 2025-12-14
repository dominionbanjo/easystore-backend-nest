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

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,

    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,

    private readonly upload: UploadService,
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
    pagination: PaginationQueryDto = { page: 1, limit: 10 },
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;

    // 1️⃣ Fetch parent categories
    const [parents, total] = await this.categoryRepo.findAndCount({
      where: { parent_id: IsNull() },
      order: { created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    if (!parents.length) {
      return {
        message: 'Categories with products retrieved successfully',
        data: buildPagination([], total, page, limit),
      };
    }

    const parentIds = parents.map((c) => c.id);

    // 2️⃣ Fetch child categories
    const children = await this.categoryRepo.find({
      where: { parent_id: In(parentIds) },
      select: ['id', 'parent_id'],
    });

    const childIds = children.map((c) => c.id);

    // 3️⃣ Fetch products belonging to child categories
    const products = await this.productRepo.find({
      where: {
        category_id: In(childIds),
      },
      order: { created_at: 'DESC' },
      take: 20 * parents.length,
    });

    // 4️⃣ Group products by parent category
    const childToParent = new Map(children.map((c) => [c.id, c.parent_id]));

    const grouped = new Map<string, Product[]>();

    for (const product of products) {
      const parentId = childToParent.get(product.category_id);
      if (!parentId) continue;

      if (!grouped.has(parentId)) {
        grouped.set(parentId, []);
      }

      if (grouped.get(parentId)!.length < 20) {
        grouped.get(parentId)!.push(product);
      }
    }

    // 5️⃣ Attach products to parent categories
    const data = parents.map((parent) => ({
      id: parent.id,
      name: parent.name,
      slug: parent.slug,
      products: grouped.get(parent.id) ?? [],
    }));

    return {
      message: 'Categories with products retrieved successfully',
      data: buildPagination(data, total, page, limit),
    };
  }

  /* ────────────────────────────────────────────────
     2️⃣ ALL PRODUCTS (FLAT LIST)
  ──────────────────────────────────────────────── */
  async getAllProducts(
    pagination: PaginationQueryDto = { page: 1, limit: 20 },
  ) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const [products, total] = await this.productRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
      relations: ['category_ref'],
    });

    return {
      message: 'Products retrieved successfully',
      data: buildPagination(products, total, page, limit),
    };
  }

  /* ────────────────────────────────────────────────
     3️⃣ PRODUCTS BY SINGLE CATEGORY
  ──────────────────────────────────────────────── */
  async getProductsByCategory(
    identifier: string,
    pagination: PaginationQueryDto = { page: 1, limit: 20 },
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

    const [products, total] = await this.productRepo.findAndCount({
      where: { category_id: category.id },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      message: 'Category products retrieved successfully',
      category,
      data: buildPagination(products, total, page, limit),
    };
  }

  /* ────────────────────────────────────────────────
     GET SINGLE PRODUCT (ID OR SLUG)
  ──────────────────────────────────────────────── */
  async getSingle(identifier: string) {
    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const product = await this.productRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      relations: ['category_ref', 'store'],
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      message: 'Product retrieved successfully',
      product,
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
  async search(
    query: string,
    pagination: PaginationQueryDto = { page: 1, limit: 20 },
  ) {
    if (!query) {
      throw new BadRequestException('Search query is required');
    }

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const qb = this.productRepo
      .createQueryBuilder('product')
      .where('product.name ILIKE :q', { q: `%${query}%` })
      .orWhere('product.description ILIKE :q', { q: `%${query}%` });

    const [products, total] = await qb
      .orderBy('product.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      message: 'Search results',
      data: buildPagination(products, total, page, limit),
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
