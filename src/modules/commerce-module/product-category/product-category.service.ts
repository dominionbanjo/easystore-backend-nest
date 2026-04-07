import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import slugify from 'slugify';
import { ProductCategory } from './entities/product-category.entity';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

@Injectable()
export class ProductCategoryService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
  ) {}

  /* ────────────────────────────────────────────────
     CREATE CATEGORY
  ──────────────────────────────────────────────── */
  async create(dto: CreateProductCategoryDto, vendorId?: string) {
    const { name, parent_id } = dto;

    const slug = slugify(name, { lower: true, strict: true });

    // Check if category exists for this vendor or in system
    const exists = await this.categoryRepo.findOne({
      where: [
        { name, vendor_id: vendorId ?? IsNull() },
        { slug, vendor_id: vendorId ?? IsNull() },
      ],
    });

    if (exists) {
      throw new BadRequestException('Category already exists');
    }

    if (parent_id) {
      const parent = await this.categoryRepo.findOne({
        where: { id: parent_id },
      });

      if (!parent) {
        throw new BadRequestException('Parent category not found');
      }
    }

    const category = this.categoryRepo.create({
      name,
      slug,
      parent_id: parent_id ?? null,
      vendor_id: vendorId ?? null,
    });

    return this.categoryRepo.save(category);
  }

  /* ────────────────────────────────────────────────
     GET ALL CATEGORIES (NESTED)
     Parents → children[]
  ──────────────────────────────────────────────── */
  // async findAll(pagination: PaginationQueryDto = { page: 1, limit: 20 }) {
  //   const page = pagination.page ?? 1;
  //   const limit = pagination.limit ?? 20;

  //   // 1️⃣ Get paginated parent categories
  //   const [parents, total] = await this.categoryRepo.findAndCount({
  //     where: { parent_id: IsNull() },
  //     relations: ['children'],
  //     order: {
  //       created_at: 'ASC',
  //       children: {
  //         created_at: 'ASC',
  //       },
  //     },
  //     skip: (page - 1) * limit,
  //     take: limit,
  //   });

  //   const result = buildPagination(parents, total, page, limit);

  //   return {
  //     message: 'Categories retrieved successfully',
  //     data: result,
  //   };
  // }

  async findAll(vendorId?: string | null) {
    /**
     * Get all parent categories with their children
     * Count products per child category
     * Results = System Default (vendor_id IS NULL) + Vendor Specific
     */
    const qb = this.categoryRepo
      .createQueryBuilder('parent')
      .leftJoinAndSelect(
        'parent.children',
        'child',
        '(child.vendor_id IS NULL OR child.vendor_id = :vendorId)',
        { vendorId: vendorId || null },
      )
      .leftJoin('products', 'product', 'product.category_id = child.id')
      .where('parent.parent_id IS NULL');

    if (vendorId) {
      qb.andWhere('(parent.vendor_id IS NULL OR parent.vendor_id = :vendorId)', {
        vendorId,
      });
    } else {
      qb.andWhere('parent.vendor_id IS NULL');
    }

    qb.select([
      'parent.id',
      'parent.name',
      'parent.slug',
      'parent.vendor_id',
      'parent.created_at',
      'child.id',
      'child.name',
      'child.slug',
      'child.vendor_id',
      'child.created_at',
    ])
      .addSelect('COUNT(product.id)', 'child_products_count')
      .groupBy('parent.id')
      .addGroupBy('child.id')
      .orderBy('parent.created_at', 'ASC')
      .addOrderBy('child.created_at', 'ASC');

    // ✅ Correct destructuring
    const { raw, entities } = await qb.getRawAndEntities();

    /**
     * Map product counts into response
     */
    const parents = entities.map((parent) => {
      let parentTotal = 0;

      const children = parent.children.map((child) => {
        const row = raw.find(
          (r) => r.parent_id === parent.id && r.child_id === child.id,
        );

        const count = Number(row?.child_products_count ?? 0);
        parentTotal += count;

        return {
          ...child,
          products_count: count,
        };
      });

      return {
        ...parent,
        products_count: parentTotal,
        children,
      };
    });

    return {
      message: 'Categories retrieved successfully',
      data: parents,
    };
  }

  /* ────────────────────────────────────────────────
     GET SINGLE CATEGORY (ID OR SLUG)
     Includes children
  ──────────────────────────────────────────────── */
  async findOne(identifier: string) {
    const isUUID = /^[0-9a-f]{8}-/.test(identifier);

    const category = await this.categoryRepo.findOne({
      where: isUUID ? { id: identifier } : { slug: identifier },
      relations: ['children'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return {
      message: 'Category retrieved successfully',
      data: category,
    };
  }

  /* ────────────────────────────────────────────────
     UPDATE CATEGORY
  ──────────────────────────────────────────────── */
  async update(id: string, dto: UpdateProductCategoryDto) {
    const category = await this.categoryRepo.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (dto.name) {
      category.name = dto.name;
      category.slug = slugify(dto.name, { lower: true, strict: true });
    }

    if (dto.parent_id !== undefined) {
      if (dto.parent_id === null) {
        category.parent_id = null;
      } else {
        const parent = await this.categoryRepo.findOne({
          where: { id: dto.parent_id },
        });

        if (!parent) {
          throw new BadRequestException('Parent category not found');
        }

        category.parent_id = dto.parent_id;
      }
    }

    return this.categoryRepo.save(category);
  }

  /* ────────────────────────────────────────────────
     DELETE CATEGORY
     (children become top-level)
  ──────────────────────────────────────────────── */
  async remove(id: string) {
    const category = await this.categoryRepo.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    await this.categoryRepo.delete(id);

    return {
      success: true,
      message: 'Category deleted successfully',
    };
  }
}
