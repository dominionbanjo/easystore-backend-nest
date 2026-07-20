import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFiles,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiPaginatedResponse } from '../../../../common/decorators/api-paginated-response.decorator';
import { ProductCardResponseDto } from '../../../../common/dto/response/product-response.dto';
import { ProductService } from '../services/product.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { CreateManyProductsDto } from '../dto/create-many-products.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { ProductSearchDto } from '../dto/product-search.dto';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/modules/identity-module/auth/guards/optional-jwt.guard';
import { StoreOwnerGuard } from 'src/modules/vendor-module/store/guards/store-owner.guard';
import { StoreGuard } from 'src/common/permissions/store.guard';
import { PermissionsGuard } from 'src/common/permissions/permissions.guard';
import { RequirePermissions } from 'src/common/permissions/permissions.decorator';
import { Permission } from 'src/common/permissions/permissions';
import { ApiStandardErrorResponses } from 'src/common/decorators/api-standard-errors.decorator';

@ApiTags('Products')
@ApiBearerAuth('JWT-auth')
@Controller('product')
@UseGuards(OptionalJwtAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /* ────────────────────────────────────────────────
     LISTING ROUTES (STATIC FIRST)
  ──────────────────────────────────────────────── */

  /**
   * 1️⃣ Homepage: Categories with limited products (20 max per category)
   */

  @ApiOperation({ summary: 'Get products grouped by category', description: 'Returns products organized by category, with a configurable limit per category. Useful for homepage display.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @ApiStandardErrorResponses()
  @Get('by-category')
  getProductsGroupedByCategory(
    @Query() pagination: PaginationQueryDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.productService.getProductsGroupedByCategory(
      pagination,
      user?.sub,
    );
  }

  /**
   * 2️⃣ Search products
   */
  @ApiOperation({ summary: 'Search products', description: 'Performs a full-text search across products with filters for category, price range, rating, and more.' })
  @ApiQuery({ name: 'q', required: false, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiQuery({ name: 'minPrice', required: false, type: Number, description: 'Minimum price' })
  @ApiQuery({ name: 'maxPrice', required: false, type: Number, description: 'Maximum price' })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Sort order' })
  @ApiQuery({ name: 'state', required: false, type: String, description: 'Filter by state' })
  @ApiQuery({ name: 'rating', required: false, type: Number, description: 'Minimum rating' })
  @ApiQuery({ name: 'inStock', required: false, type: Boolean, description: 'Filter by in-stock' })
  @ApiOkResponse({ description: 'Search results retrieved successfully' })
  @ApiStandardErrorResponses()
  @Get('search')
  search(
    @Query() query: ProductSearchDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.productService.search(query, user?.sub);
  }

  /**
   * 3️⃣ Products by single category (id or slug)
   */
  @ApiOperation({ summary: 'Get products by category', description: 'Returns all products belonging to a specific category, identified by ID or slug.' })
  @ApiParam({ name: 'identifier', description: 'Category ID or slug', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @ApiStandardErrorResponses()
  @Get('category/:identifier')
  getProductsByCategory(
    @Param('identifier') identifier: string,
    @Query() pagination: PaginationQueryDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.productService.getProductsByCategory(
      identifier,
      pagination,
      user?.sub,
    );
  }

  /**
   * 🏪 Products for current vendor's store
   * GET /product/store/me
   */
  @ApiOperation({ summary: 'Get my store products', description: 'Retrieves all products for the currently authenticated vendor store.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @ApiStandardErrorResponses()
  @Get('store/me')
  @UseGuards(JwtAuthGuard, StoreGuard)
  getMyStoreProducts(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.productService.getByStore(user.store_id!, pagination, user.sub);
  }
  /**
   * 4️⃣ Products by store
   */
  @ApiOperation({ summary: 'Get products by store', description: 'Returns all products belonging to a specific store by its ID.' })
  @ApiParam({ name: 'storeId', description: 'Store ID', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @ApiStandardErrorResponses()
  @Get('store/:storeId')
  getProductsByStore(
    @Param('storeId') storeId: string,
    @Query() pagination: PaginationQueryDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.productService.getByStore(storeId, pagination, user?.sub);
  }

  /**
   * 5️⃣ All products (flat list)
   */
  @ApiOperation({ summary: 'Get all products', description: 'Returns a flat paginated list of all products available on the platform.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @ApiStandardErrorResponses()
  @Get()
  getAllProducts(
    @Query() pagination: PaginationQueryDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.productService.getAllProducts(pagination, user?.sub);
  }

  /**
   * ⭐ Featured products (homepage)
   */

  @ApiOperation({ summary: 'Get featured products', description: 'Returns a curated list of featured products for display on the homepage.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page' })
  @ApiPaginatedResponse(ProductCardResponseDto)
  @ApiStandardErrorResponses()
  @Get('featured')
  getFeaturedProducts(
    @Query() pagination: PaginationQueryDto,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.productService.getFeaturedProducts(
      pagination,
      user?.sub, // ✅ pass userId if exists
    );
  }

  /* ────────────────────────────────────────────────
     SINGLE RESOURCE
  ──────────────────────────────────────────────── */

  /**
   * 6️⃣ Get single product (id or slug)
   */

  @ApiOperation({ summary: 'Get a single product', description: 'Retrieves a single product by its ID or slug.' })
  @ApiParam({ name: 'identifier', description: 'Product ID or slug', type: String })
  @ApiOkResponse({ description: 'Product retrieved successfully' })
  @ApiStandardErrorResponses()
  @Get(':identifier')
  getSingle(
    @Param('identifier') identifier: string,
    @CurrentUser() user?: jwtStrategy.JwtAuthUser,
  ) {
    return this.productService.getSingle(identifier, user?.sub);
  }

  /* ────────────────────────────────────────────────
     MUTATION ROUTES
  ──────────────────────────────────────────────── */

  /**
   * 7️⃣ Create product (generic)
   */
  @ApiOperation({ summary: 'Create a product', description: 'Creates a new product with optional image and gallery uploads. Restricted to store owners.' })
  @ApiCreatedResponse({ description: 'Product created successfully' })
  @ApiStandardErrorResponses()
  @Post()
  @RequirePermissions(Permission.CREATE_PRODUCT)
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'gallery', maxCount: 10 },
    ]),
  )
  create(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateProductDto,
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
      gallery?: Express.Multer.File[];
    },
  ) {
    return this.productService.create(user, dto, files);
  }

  @ApiOperation({ summary: 'Bulk create products', description: 'Creates multiple products at once. Restricted to store owners.' })
  @ApiCreatedResponse({ description: 'Products created in bulk successfully' })
  @ApiStandardErrorResponses()
  @Post('bulk')
  @RequirePermissions(Permission.CREATE_PRODUCT)
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  createMany(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateManyProductsDto,
  ) {
    return this.productService.createMany(user, dto.products);
  }
  /**
   * 9️⃣ Update product
   */
  @ApiOperation({ summary: 'Update a product', description: 'Updates an existing product by its ID.' })
  @ApiParam({ name: 'id', description: 'Product ID', type: String })
  @ApiOkResponse({ description: 'Product updated successfully' })
  @ApiStandardErrorResponses()
  @Patch(':id')
  @RequirePermissions(Permission.UPDATE_PRODUCT)
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  /**
   * 🔟 Delete product
   */
  @ApiOperation({ summary: 'Delete a product', description: 'Permanently removes a product by its ID.' })
  @ApiParam({ name: 'id', description: 'Product ID', type: String })
  @ApiOkResponse({ description: 'Product deleted successfully' })
  @ApiStandardErrorResponses()
  @Delete(':id')
  @RequirePermissions(Permission.DELETE_PRODUCT)
  @UseGuards(JwtAuthGuard, PermissionsGuard, StoreOwnerGuard)
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
