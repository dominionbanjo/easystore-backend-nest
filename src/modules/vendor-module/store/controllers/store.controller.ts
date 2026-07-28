import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiOkResponse, ApiCreatedResponse, ApiParam, ApiQuery, ApiBody } from '@nestjs/swagger';
import { ApiStandardErrorResponses } from '../../../../common/decorators/api-standard-errors.decorator';
import { ApiPaginatedResponse } from '../../../../common/decorators/api-paginated-response.decorator';
import { StoreListItemDto } from '../../../../common/dto/response/store-response.dto';
import { SuccessResponseDto, SuccessWithIdDto } from '../../../../common/dto/api-response.dto';
import { ProductCardResponseDto } from '../../../../common/dto/response/product-response.dto';
import { UpdateStoreDto } from '../dto/update-store.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/modules/identity-module/auth/guards/optional-jwt.guard';
import { StoreOwnerGuard } from '../guards/store-owner.guard';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { StoreService } from '../services/store.service';
import { Permission } from 'src/common/permissions/permissions';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { mapToOwnerStore } from '../utils/store-sanitizer.util';

@ApiTags('Stores')
@ApiBearerAuth('JWT-auth')
@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  /* ────────────────────────────────────────────────
     PUBLIC STORE ROUTES
  ──────────────────────────────────────────────── */

  @ApiOperation({ summary: 'Create a store', description: 'Create a new store for the authenticated user' })
  @ApiCreatedResponse({ type: SuccessWithIdDto, description: 'Store created successfully' })
  @ApiStandardErrorResponses()
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: import('../dto/create-store.dto').CreateStoreDto,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    dto.user_id = user.sub;
    return this.storeService.createStore(dto);
  }

  @ApiOperation({ summary: 'Get my store', description: 'Retrieve the store associated with the authenticated user' })
  @ApiOkResponse({ description: 'Store details for the current user' })
  @ApiStandardErrorResponses()
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyStore(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    const store = await this.storeService.getStoreByUser(user.sub);
    return mapToOwnerStore(store);
  }

  @ApiOperation({ summary: 'Get my stores', description: 'Get all stores owned by the current user' })
  @ApiOkResponse({ description: 'List of stores' })
  @ApiStandardErrorResponses()
  @Get('my-stores')
  @UseGuards(JwtAuthGuard)
  async getMyStores(@CurrentUser() user: jwtStrategy.JwtAuthUser) {
    const stores = await this.storeService.getStoresByUser(user.sub);
    return stores.map((s) => mapToOwnerStore(s));
  }

  @ApiOperation({ summary: 'Get all stores', description: 'Retrieve paginated list of all stores (public)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(StoreListItemDto)
  @ApiStandardErrorResponses()
  @Get()
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.storeService.getAllStores(pagination);
  }

  @ApiOperation({ summary: 'Search stores', description: 'Search stores by query string with pagination (public)' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(StoreListItemDto)
  @ApiStandardErrorResponses()
  @Get('search')
  searchStores(@Query('q') q: string, @Query() pagination: PaginationQueryDto) {
    return this.storeService.searchStores(q, pagination);
  }

  /* ────────────────────────────────────────────────
     THEME / TEMPLATE PUBLIC ROUTES
  ──────────────────────────────────────────────── */

  @ApiOperation({ summary: 'Get store templates', description: 'Retrieve available store theme templates (public)' })
  @ApiOkResponse({ description: 'List of available templates' })
  @ApiStandardErrorResponses()
  @Get('templates')
  getTemplates() {
    return this.storeService.getTemplates();
  }

  @ApiOperation({ summary: 'Get store theme', description: 'Retrieve the theme configuration for a store by slug (public)' })
  @ApiParam({ name: 'slug', description: 'Store slug', type: String })
  @ApiOkResponse({ description: 'Store theme configuration' })
  @ApiStandardErrorResponses()
  @Get(':slug/theme')
  getStoreTheme(@Param('slug') slug: string) {
    return this.storeService.getStoreTheme(slug);
  }

  @ApiOperation({ summary: 'Get store products by category', description: 'Retrieve products for a store filtered by category (public, with optional auth for pricing)' })
  @ApiParam({ name: 'identifier', description: 'Store ID or slug', type: String })
  @ApiParam({ name: 'categoryId', description: 'Category ID', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @ApiStandardErrorResponses()
  @Get(':identifier/category/:categoryId/products')
  @UseGuards(OptionalJwtAuthGuard)
  getStoreProductsByCategory(
    @Param('identifier') identifier: string,
    @Param('categoryId') categoryId: string,
    @Query() pagination: PaginationQueryDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.storeService.getStoreProductsByCategory(
      identifier,
      categoryId,
      pagination,
      user?.sub,
    );
  }

  @ApiOperation({ summary: 'Get store products', description: 'Retrieve paginated products for a store by identifier (public, with optional auth for pricing)' })
  @ApiParam({ name: 'identifier', description: 'Store ID or slug', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @ApiStandardErrorResponses()
  @Get(':identifier/products')
  @UseGuards(OptionalJwtAuthGuard)
  getStoreProducts(
    @Param('identifier') identifier: string,
    @Query() query: PaginationQueryDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.storeService.getStoreProducts(identifier, query, user?.sub);
  }
  @ApiOperation({ summary: 'Get store by identifier', description: 'Retrieve a store by slug or ID with optional products and categories (public, with optional auth)' })
  @ApiParam({ name: 'identifier', description: 'Store ID or slug', type: String })
  @ApiQuery({ name: 'includeProducts', required: false, type: Boolean, description: 'Include products in response' })
  @ApiQuery({ name: 'includeCategories', required: false, type: Boolean, description: 'Include categories in response' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiOkResponse({ description: 'Store details' })
  @ApiStandardErrorResponses()
  @Get(':identifier')
  @UseGuards(OptionalJwtAuthGuard)
  findOne(
    @Param('identifier') identifier: string,
    @Query('includeProducts') includeProducts?: string,
    @Query('includeCategories') includeCategories?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.storeService.getStore(identifier, {
      includeProducts: includeProducts === 'true',
      includeCategories: includeCategories !== 'false', // default true
      productPage: page ? Number(page) : 1,
      productLimit: limit ? Number(limit) : 20,
      userId: user?.sub,
    });
  }

  @ApiOperation({ summary: 'Get store products grouped by category', description: 'Retrieve products grouped by category for a store (public, with optional auth)' })
  @ApiParam({ name: 'identifier', description: 'Store ID or slug', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiOkResponse({ description: 'Products grouped by category' })
  @ApiStandardErrorResponses()
  @Get(':identifier/products/grouped-by-category')
  @UseGuards(OptionalJwtAuthGuard)
  getStoreProductsGroupedByCategory(
    @Param('identifier') identifier: string,
    @Query() pagination: PaginationQueryDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.storeService.getStoreProductsGroupedByCategory(
      identifier,
      pagination,
      user?.sub,
    );
  }

  /* ────────────────────────────────────────────────
     UPDATE / DELETE STORE
  ──────────────────────────────────────────────── */
  @ApiOperation({ summary: 'Update store', description: 'Update store details including logo and cover image' })
  @ApiParam({ name: 'id', description: 'Store ID', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Store updated successfully' })
  @ApiStandardErrorResponses()
  @Patch(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.MANAGE_STORE)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'cover_image', maxCount: 1 },
    ]),
  )
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
    @UploadedFiles()
    files?: {
      logo?: Express.Multer.File[];
      cover_image?: Express.Multer.File[];
    },
  ) {
    return this.storeService.updateStore(id, dto, files);
  }

  @ApiOperation({ summary: 'Update store theme', description: 'Update the theme configuration for a store' })
  @ApiParam({ name: 'id', description: 'Store ID', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Store theme updated successfully' })
  @ApiStandardErrorResponses()
  @Patch(':id/theme')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.MANAGE_STORE)
  updateStoreTheme(
    @Param('id') id: string,
    @Body() dto: import('../dto/update-theme.dto').UpdateThemeDto,
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
  ) {
    return this.storeService.updateStoreTheme(id, user.sub, dto);
  }

  @ApiOperation({ summary: 'Delete store', description: 'Permanently delete a store (admin or store owner only)' })
  @ApiParam({ name: 'id', description: 'Store ID', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Store deleted successfully' })
  @ApiStandardErrorResponses()
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @RequirePermissions(Permission.MANAGE_SETTINGS) // Only high-level or admin can delete
  remove(@Param('id') id: string) {
    return this.storeService.deleteStore(id);
  }

  /* ────────────────────────────────────────────────
     BANK ROUTES (STORE SUB-RESOURCE)
  ──────────────────────────────────────────────── */

  @ApiOperation({ summary: 'Register bank account', description: 'Register a bank account for a store to receive payouts' })
  @ApiParam({ name: 'id', description: 'Store ID', type: String })
  @ApiBody({ description: 'Bank account details', type: Object })
  @ApiCreatedResponse({ type: SuccessResponseDto, description: 'Bank account registered successfully' })
  @ApiStandardErrorResponses()
  @Post(':id/bank')
  @UseGuards(JwtAuthGuard, StoreOwnerGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_STORE)
  registerBank(
    @Param('id') storeId: string,
    @Body('bank_code') bank_code: string,
    @Body('account_number') account_number: string,
    @Body('settlement_email') settlement_email?: string,
  ) {
    return this.storeService.registerBankAccount(
      storeId,
      bank_code,
      account_number,
      settlement_email,
    );
  }

  @ApiOperation({ summary: 'Update bank account', description: 'Update the bank account details for a store' })
  @ApiParam({ name: 'id', description: 'Store ID', type: String })
  @ApiBody({ description: 'Updated bank account details', type: Object })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Bank account updated successfully' })
  @ApiStandardErrorResponses()
  @Patch(':id/bank')
  @UseGuards(JwtAuthGuard, StoreOwnerGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_STORE)
  updateBank(
    @Param('id') storeId: string,
    @Body()
    updates: {
      bank_code?: string;
      account_number?: string;
      settlement_email?: string;
    },
  ) {
    return this.storeService.updateBankAccount(storeId, updates);
  }

  @ApiOperation({ summary: 'Delete bank account', description: 'Remove the bank account associated with a store' })
  @ApiParam({ name: 'id', description: 'Store ID', type: String })
  @ApiOkResponse({ type: SuccessResponseDto, description: 'Bank account deleted successfully' })
  @ApiStandardErrorResponses()
  @Delete(':id/bank')
  @UseGuards(JwtAuthGuard, StoreOwnerGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_STORE)
  removeBank(@Param('id') storeId: string) {
    return this.storeService.deleteBankAccount(storeId);
  }
}
