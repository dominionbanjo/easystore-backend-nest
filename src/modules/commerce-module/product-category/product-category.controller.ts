import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';

import { ProductCategoryService } from './product-category.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';

@Controller('categories')
export class ProductCategoryController {
  constructor(
    private readonly productCategoryService: ProductCategoryService,
  ) {}

  /* ────────────────────────────────────────────────
     CREATE CATEGORY
     POST /product-categories
  ──────────────────────────────────────────────── */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin') // 🔒 ALL routes admin-only
  @Post()
  create(@Body() dto: CreateProductCategoryDto) {
    return this.productCategoryService.create(dto);
  }

  /* ────────────────────────────────────────────────
     GET ALL CATEGORIES (TREE)
     GET /product-categories
  ──────────────────────────────────────────────── */
  @Get()
  findAll() {
    return this.productCategoryService.findAll();
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin') // 🔒 ALL routes admin-only
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductCategoryDto) {
    return this.productCategoryService.update(id, dto);
  }

  /* ────────────────────────────────────────────────
     DELETE CATEGORY
     DELETE /product-categories/:id
  ──────────────────────────────────────────────── */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin') // 🔒 ALL routes admin-only
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productCategoryService.remove(id);
  }
}
