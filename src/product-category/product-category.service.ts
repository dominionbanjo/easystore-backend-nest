// src/product-category/product-category.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import slugify from 'slugify';

import { ProductCategory } from './entities/product-category.entity';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { buildPagination } from 'src/common/utils/response/pagination.util';

@Injectable()
export class ProductCategoryService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
  ) {}

  /* ────────────────────────────────────────────────
     CREATE CATEGORY
  ──────────────────────────────────────────────── */
  async create(dto: CreateProductCategoryDto) {
    const { name, parent_id } = dto;

    const slug = slugify(name, { lower: true, strict: true });

    const exists = await this.categoryRepo.findOne({
      where: [{ name }, { slug }],
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
    });

    return this.categoryRepo.save(category);
  }

  /* ────────────────────────────────────────────────
     GET ALL CATEGORIES (NESTED)
     Parents → children[]
  ──────────────────────────────────────────────── */
  async findAll(pagination: PaginationQueryDto = { page: 1, limit: 20 }) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    // 1️⃣ Get paginated parent categories
    const [parents, total] = await this.categoryRepo.findAndCount({
      where: { parent_id: IsNull() },
      relations: ['children'],
      order: {
        created_at: 'ASC',
        children: {
          created_at: 'ASC',
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    const result = buildPagination(parents, total, page, limit);

    return {
      message: 'Categories retrieved successfully',
      data: result,
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
