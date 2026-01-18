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
} from '@nestjs/common';

import { ProductService } from '../product.service';
import { ProductStatus } from '../entities/product.entity';
import { ProductSearchDto } from '../dto/product-search.dto';
import { CreateProductCloudinaryDto } from '../dto/create-product-cloudinary.dto';

import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';

import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/modules/identity-module/auth/guards/optional-jwt.guard';
import { RolesGuard } from 'src/modules/identity-module/auth/guards/roles.guard';
import { Roles } from 'src/modules/identity-module/auth/decorators/roles.decorator';
import { StoreOwnerGuard } from 'src/modules/vendor-module/store/guards/store-owner.guard';

@Controller('vendor/products')
export class VendorProductController {
  constructor(private readonly productService: ProductService) {}

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
     🔍 VENDOR: SEARCH PRODUCTS IN MY STORE
     GET /vendor/products/store/me/search
  ──────────────────────────────────────────────── */
  @Get('store/me/search')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor', 'admin')
  searchMyStoreProducts(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() query: ProductSearchDto,
  ) {
    if (!user.store_id) {
      throw new NotFoundException('User does not own a store');
    }

    return this.productService.searchStoreProducts(
      user.store_id,
      query,
      user.sub,
    );
  }

  /* ────────────────────────────────────────────────
     🆕 VENDOR: CREATE PRODUCT (CLOUDINARY)
     POST /vendor/products
     (NO FILE UPLOAD — frontend uploads to Cloudinary)
  ──────────────────────────────────────────────── */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, StoreOwnerGuard)
  @Roles('vendor', 'admin')
  createProductWithCloudinary(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateProductCloudinaryDto,
  ) {
    return this.productService.createWithCloudinary(user, dto);
  }

  /* ────────────────────────────────────────────────
     🔒 VENDOR: ACTIVATE / DEACTIVATE PRODUCT
     PATCH /vendor/products/:id/status
  ──────────────────────────────────────────────── */
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard, StoreOwnerGuard)
  @Roles('vendor', 'admin')
  updateProductStatus(
    @Param('id') productId: string,
    @Body('status') status: ProductStatus,
  ) {
    return this.productService.updateStatus(productId, status);
  }
}
