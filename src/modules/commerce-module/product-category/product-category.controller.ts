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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
} from '@nestjs/swagger';

import { ApiPaginatedResponse } from '../../../common/decorators/api-paginated-response.decorator';
import { ProductCategoryService } from './product-category.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/modules/identity-module/auth/guards/optional-jwt.guard';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { Permission } from 'src/common/permissions/permissions';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';

@ApiTags('Categories')
@ApiBearerAuth('JWT-auth')
@Controller('categories')
export class ProductCategoryController {
  constructor(
    private readonly productCategoryService: ProductCategoryService,
  ) {}

  /* ────────────────────────────────────────────────
     CREATE CATEGORY
     POST /product-categories
  ──────────────────────────────────────────────── */
  @Post()
  @RequirePermissions(Permission.MANAGE_CATEGORIES)
  @ApiOperation({ summary: 'Create a category', description: 'Creates a new product category. Restricted to admin and vendor roles.' })
  @ApiCreatedResponse({ description: 'Category created successfully' })
  @ApiStandardErrorResponses()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  create(
    @Body() dto: CreateProductCategoryDto,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    const vendorId = user.role === 'admin' ? undefined : (user.store_id ?? undefined);
    return this.productCategoryService.create(dto, vendorId);
  }

  /* ────────────────────────────────────────────────
     GET ALL CATEGORIES (TREE)
     GET /product-categories
  ──────────────────────────────────────────────── */
  @Get()
  @ApiOperation({ summary: 'Get all categories', description: 'Retrieves all product categories in a tree structure. Optional authentication for vendor-specific categories.' })
  @ApiPaginatedResponse(Object)
  @ApiStandardErrorResponses()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(@CurrentUser() user?: jwtStrategy.JwtAuthUser) {
    return this.productCategoryService.findAll(user?.store_id ?? undefined);
  }

  /* ────────────────────────────────────────────────
     GET SINGLE CATEGORY (by id or slug)
     GET /product-categories/:identifier
  ──────────────────────────────────────────────── */
  @Get(':identifier')
  @ApiOperation({ summary: 'Get a category', description: 'Retrieves a single category by its ID or slug.' })
  @ApiParam({ name: 'identifier', description: 'Category ID or slug', type: String })
  @ApiOkResponse({ description: 'Category retrieved successfully' })
  @ApiStandardErrorResponses()
  findOne(@Param('identifier') identifier: string) {
    return this.productCategoryService.findOne(identifier);
  }

  /* ────────────────────────────────────────────────
     UPDATE CATEGORY
     PATCH /product-categories/:id
  ──────────────────────────────────────────────── */
  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_CATEGORIES)
  @ApiOperation({ summary: 'Update a category', description: 'Updates an existing product category. Restricted to admin role.' })
  @ApiParam({ name: 'id', description: 'Category ID', type: String })
  @ApiOkResponse({ description: 'Category updated successfully' })
  @ApiStandardErrorResponses()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProductCategoryDto,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.productCategoryService.update(id, dto, user);
  }

  /* ────────────────────────────────────────────────
     DELETE CATEGORY
     DELETE /product-categories/:id
  ──────────────────────────────────────────────── */
  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_CATEGORIES)
  @ApiOperation({ summary: 'Delete a category', description: 'Permanently removes a product category. Restricted to admin role.' })
  @ApiParam({ name: 'id', description: 'Category ID', type: String })
  @ApiOkResponse({ description: 'Category deleted successfully' })
  @ApiStandardErrorResponses()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.productCategoryService.remove(id, user);
  }
}
