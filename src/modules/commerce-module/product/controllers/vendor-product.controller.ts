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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';

import { ApiPaginatedResponse } from '../../../../common/decorators/api-paginated-response.decorator';
import { ProductCardResponseDto } from '../../../../common/dto/response/product-response.dto';
import { SuccessResponseDto, SuccessWithIdDto } from '../../../../common/dto/api-response.dto';
import { ProductService } from '../services/product.service';
import { ProductStatus } from '../entities/product.entity';
import { ProductSearchDto } from '../dto/product-search.dto';
import { CreateProductCloudinaryDto } from '../dto/create-product-cloudinary.dto';

import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';

import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/modules/identity-module/auth/guards/optional-jwt.guard';
import { Permission } from 'src/common/permissions/permissions';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { StoreOwnerGuard } from 'src/modules/vendor-module/store/guards/store-owner.guard';
import { StoreGuard } from 'src/common/permissions/store.guard';
import { UpdateProductCloudinaryDto } from '../dto/update-product-cloudinary.dto';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';

@ApiTags('Vendor Products')
@ApiBearerAuth('JWT-auth')
@Controller('vendor/products')
export class VendorProductController {
  constructor(private readonly productService: ProductService) {}

  /* ────────────────────────────────────────────────
     📋 VENDOR: GET ALL MY PRODUCTS (Unified Search & List)
     GET /vendor/products
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get all vendor products', description: 'Retrieves all products for the authenticated vendor with optional search and filters.' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'Filter by product status' })
  @ApiQuery({ name: 'inStock', required: false, type: Boolean, description: 'Filter by in-stock' })
  @ApiQuery({ name: 'onSale', required: false, type: Boolean, description: 'Filter by on-sale' })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @ApiStandardErrorResponses()
  @Get()
  @UseGuards(JwtAuthGuard, StoreGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_PRODUCT)
  getAllProducts(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() query: ProductSearchDto,
  ) {
    return this.productService.getVendorProducts(user.store_id!, query);
  }

  /* ────────────────────────────────────────────────
     💰 SALES TERMINAL: GET PAGINATED PRODUCTS
     GET /vendor/products/sales-terminal
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get sales terminal products', description: 'Returns paginated active products for the sales terminal grid' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Search by product or category name' })
  @ApiQuery({ name: 'category', required: false, type: String, description: 'Filter by category name' })
  @ApiOkResponse({ description: 'Paginated sales terminal products' })
  @ApiStandardErrorResponses()
  @Get('sales-terminal')
  @UseGuards(JwtAuthGuard, StoreGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_PRODUCT)
  getSalesTerminalProducts(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
    @Query('category') category?: string,
  ) {
    return this.productService.getSalesTerminalProducts(user.store_id!, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      q,
      category,
    });
  }

  /* ────────────────────────────────────────────────
     💰 SALES TERMINAL: GET CATEGORIES
     GET /vendor/products/sales-terminal/categories
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get sales terminal categories', description: 'Returns distinct categories with product counts for the sales terminal' })
  @ApiOkResponse({ description: 'Sales terminal categories returned' })
  @ApiStandardErrorResponses()
  @Get('sales-terminal/categories')
  @UseGuards(JwtAuthGuard, StoreGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_PRODUCT)
  getSalesTerminalCategories(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    return this.productService.getSalesTerminalCategories(user.store_id!);
  }

  /* ────────────────────────────────────────────────
     🔍 VENDOR: SEARCH PRODUCTS IN MY STORE
     GET /vendor/products/store/me/search
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Search vendor products', description: 'Searches within the authenticated vendor store products using various filters.' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'minPrice', required: false, type: Number, description: 'Minimum price' })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number, description: 'Maximum price' })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @ApiStandardErrorResponses()
  @Get('store/me/search')
  @UseGuards(JwtAuthGuard, StoreGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_PRODUCT)
  searchMyStoreProducts(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() query: ProductSearchDto,
  ) {
    return this.productService.searchStoreProductsEntity(user.store_id!, query);
  }

  /* ────────────────────────────────────────────────
     🔍 VENDOR: GET SINGLE PRODUCT (For Editing)
     GET /vendor/products/:idOrSlug
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Get vendor product by ID or slug', description: 'Retrieves a single product by ID or slug for vendor editing purposes.' })
  @ApiParam({ name: 'idOrSlug', description: 'Product ID or slug', type: String })
  @ApiOkResponse({ description: 'Product retrieved successfully' })
  @ApiStandardErrorResponses()
  @Get(':idOrSlug')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.VIEW_PRODUCT)
  getVendorSingle(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Param('idOrSlug') identifier: string,
  ) {
    return this.productService.getVendorSingle(identifier, user.store_id!);
  }


  /* ────────────────────────────────────────────────
     🔍 PUBLIC: SEARCH PRODUCTS IN A STORE
     GET /vendor/products/store/:storeId/search
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Search products in a store', description: 'Public endpoint to search products within a specific store by store ID.' })
  @ApiParam({ name: 'storeId', description: 'Store ID', type: String })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @ApiStandardErrorResponses()
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
     📷 BARCODE LOOKUP
     GET /vendor/products/barcode/:code
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Lookup product by barcode', description: 'Returns the product and optional variant for a scanned barcode.' })
  @ApiParam({ name: 'code', description: 'Barcode / UPC / EAN', type: String })
  @ApiOkResponse({ description: 'Product found' })
  @ApiStandardErrorResponses()
  @Get('barcode/:code')
  @UseGuards(JwtAuthGuard, StoreGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_PRODUCT)
  lookupByBarcode(
    @Param('code') code: string,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.productService.lookupByBarcode(code, user.store_id!);
  }

  /* ────────────────────────────────────────────────
     🆕 VENDOR: CREATE PRODUCT (CLOUDINARY)
     POST /vendor/products
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Create a vendor product', description: 'Creates a new product for the authenticated vendor store with Cloudinary image support.' })
  @ApiCreatedResponse({ type: SuccessWithIdDto, description: 'Product created successfully' })
  @ApiStandardErrorResponses()
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
  @ApiOperation({ summary: 'Update a vendor product', description: 'Updates an existing product for the authenticated vendor store.' })
  @ApiParam({ name: 'id', description: 'Product ID', type: String })
  @ApiOkResponse({ type: SuccessWithIdDto, description: 'Product updated successfully' })
  @ApiStandardErrorResponses()
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
  @ApiOperation({ summary: 'Update product status', description: 'Activates or deactivates a product listing for the vendor store.' })
  @ApiParam({ name: 'id', description: 'Product ID', type: String })
  @ApiBody({ description: 'New product status', schema: { properties: { status: { type: 'string' } } } })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Product status updated successfully' })
  @ApiStandardErrorResponses()
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
  @ApiOperation({ summary: 'Toggle product on-sale status', description: 'Marks or unmarks a product as being on sale.' })
  @ApiParam({ name: 'id', description: 'Product ID', type: String })
  @ApiBody({ description: 'Toggle on sale', schema: { properties: { on_sale: { type: 'boolean' } } } })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Product on-sale status updated successfully' })
  @ApiStandardErrorResponses()
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
  @ApiOperation({ summary: 'Delete a vendor product', description: 'Permanently removes a product from the vendor store.' })
  @ApiParam({ name: 'id', description: 'Product ID', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Product deleted successfully' })
  @ApiStandardErrorResponses()
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.DELETE_PRODUCT)
  removeProduct(@Param('id') productId: string) {
    return this.productService.remove(productId);
  }
}
