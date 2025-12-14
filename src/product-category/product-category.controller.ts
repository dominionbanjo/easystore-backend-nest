import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';

import { ProductCategoryService } from './product-category.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin') // 🔒 ALL routes admin-only
export class ProductCategoryController {
  constructor(
    private readonly productCategoryService: ProductCategoryService,
  ) {}

  /* ────────────────────────────────────────────────
     CREATE CATEGORY
     POST /product-categories
  ──────────────────────────────────────────────── */
  @Post()
  create(@Body() dto: CreateProductCategoryDto) {
    return this.productCategoryService.create(dto);
  }

  /* ────────────────────────────────────────────────
     GET ALL CATEGORIES (TREE)
     GET /product-categories
  ──────────────────────────────────────────────── */
  @Get()
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.productCategoryService.findAll(pagination);
  }

  /* ────────────────────────────────────────────────
     GET SINGLE CATEGORY (by id or slug)
     GET /product-categories/:identifier
  ──────────────────────────────────────────────── */
  @Get(':identifier')
  findOne(@Param('identifier') identifier: string) {
    return this.productCategoryService.findOne(identifier);
  }

  /* ────────────────────────────────────────────────
     UPDATE CATEGORY
     PATCH /product-categories/:id
  ──────────────────────────────────────────────── */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductCategoryDto) {
    return this.productCategoryService.update(id, dto);
  }

  /* ────────────────────────────────────────────────
     DELETE CATEGORY
     DELETE /product-categories/:id
  ──────────────────────────────────────────────── */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productCategoryService.remove(id);
  }
}
