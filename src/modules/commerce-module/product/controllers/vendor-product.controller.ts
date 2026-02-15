import {
  Controller,
  Patch,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  NotFoundException,
  Delete,
} from '@nestjs/common';

import { ProductService } from '../services/product.service';
import { ProductStatus } from '../entities/product.entity';
import { ProductSearchDto } from '../dto/product-search.dto';
import { CreateProductCloudinaryDto } from '../dto/create-product-cloudinary.dto';
import { UpdateProductCloudinaryDto } from '../dto/update-product=coudinary.dto';

import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';

import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/modules/identity-module/auth/guards/optional-jwt.guard';
import { Permission } from 'src/common/permissions/permissions';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { StoreOwnerGuard } from 'src/modules/vendor-module/store/guards/store-owner.guard';

@Controller('vendor/products')
export class VendorProductController {
  constructor(private readonly productService: ProductService) {}

  /* ────────────────────────────────────────────────
     📋 VENDOR: GET ALL MY PRODUCTS (Unified Search & List)
     GET /vendor/products
  ──────────────────────────────────────────────── */
  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_PRODUCT)
  getAllProducts(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() query: ProductSearchDto,
  ) {
    if (!user.store_id) {
      throw new NotFoundException('User does not own a store');
    }
    return this.productService.getVendorProducts(user.store_id, query);
  }

  /* ────────────────────────────────────────────────
     🔍 VENDOR: SEARCH PRODUCTS IN MY STORE
     GET /vendor/products/store/me/search
  ──────────────────────────────────────────────── */
  @Get('store/me/search')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_PRODUCT)
  searchMyStoreProducts(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() query: ProductSearchDto,
  ) {
    if (!user.store_id) {
      throw new NotFoundException('User does not own a store');
    }

    return this.productService.searchStoreProductsEntity(user.store_id, query);
  }

  /* ────────────────────────────────────────────────
     🔍 PUBLIC: SEARCH PRODUCTS IN A STORE
     GET /vendor/products/store/:storeId/search
  ──────────────────────────────────────────────── */
  @Get('store/:storeId/search')
  @UseGuards(OptionalJwtAuthGuard)
  searchStoreProducts(
    @Param('storeId') storeId: string,
    @Query() query: ProductSearchDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.productService.searchStoreProducts(storeId, query, user?.sub);
  }

  /* ────────────────────────────────────────────────
     🆕 VENDOR: CREATE PRODUCT (CLOUDINARY)
     POST /vendor/products
  ──────────────────────────────────────────────── */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.CREATE_PRODUCT)
  createWithCloudinary(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateProductCloudinaryDto,
  ) {
    return this.productService.createWithCloudinary(user, dto);
  }

  /* ────────────────────────────────────────────────
     ✏️ VENDOR: UPDATE PRODUCT
     PATCH /vendor/products/:id
  ──────────────────────────────────────────────── */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.UPDATE_PRODUCT)
  updateWithCloudinary(
    @Param('id') productId: string,
    @Body() dto: UpdateProductCloudinaryDto,
  ) {
    return this.productService.updateWithCloudinary(productId, dto);
  }

  /* ────────────────────────────────────────────────
     🔒 VENDOR: ACTIVATE / DEACTIVATE PRODUCT
     PATCH /vendor/products/:id/status
  ──────────────────────────────────────────────── */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.UPDATE_PRODUCT)
  updateProductStatus(
    @Param('id') productId: string,
    @Body('status') status: ProductStatus,
  ) {
    return this.productService.updateStatus(productId, status);
  }

  /* ────────────────────────────────────────────────
     🏷️ VENDOR: MARK / UNMARK PRODUCT AS ON SALE
     PATCH /vendor/products/:id/on-sale
  ──────────────────────────────────────────────── */
  @Patch(':id/on-sale')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.UPDATE_PRODUCT)
  updateProductOnSale(
    @Param('id') productId: string,
    @Body('on_sale') onSale: boolean,
  ) {
    return this.productService.updateOnSale(productId, onSale);
  }

  /* ────────────────────────────────────────────────
     🗑️ VENDOR: DELETE PRODUCT
     DELETE /vendor/products/:id
  ──────────────────────────────────────────────── */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.DELETE_PRODUCT)
  removeProduct(@Param('id') productId: string) {
    return this.productService.remove(productId);
  }
}
