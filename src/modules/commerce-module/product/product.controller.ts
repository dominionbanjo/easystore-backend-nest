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
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { CreateManyProductsDto } from './dto/create-many-products.dto';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as jwtStrategy from 'src/modules/identity-module/auth/strategies/jwt.strategy';
import { ProductSearchDto } from './dto/product-search.dto';
import { CurrentUser } from 'src/modules/identity-module/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/modules/identity-module/auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from 'src/modules/identity-module/auth/guards/optional-jwt.guard';
import { StoreOwnerGuard } from 'src/modules/vendor-module/store/guards/store-owner.guard';

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
  @Get('search')
  // @UsePipes(
  //   new ValidationPipe({
  //     transform: true,
  //     whitelist: true,
  //   }),
  // )
  search(@Query() query: ProductSearchDto) {
    return this.productService.search(query);
  }

  /**
   * 3️⃣ Products by single category (id or slug)
   */
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
   * 4️⃣ Products by store
   */
  @Get('store/:storeId')
  getProductsByStore(
    @Param('storeId') storeId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.productService.getByStore(storeId, pagination);
  }

  /**
   * 5️⃣ All products (flat list)
   */
  @Get()
  getAllProducts(@Query() pagination: PaginationQueryDto) {
    return this.productService.getAllProducts(pagination);
  }

  /**
   * ⭐ Featured products (homepage)
   */

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
  @Post()
  @UseGuards(JwtAuthGuard, StoreOwnerGuard)
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

  @Post('bulk')
  @UseGuards(JwtAuthGuard, StoreOwnerGuard)
  createMany(
    @CurrentUser() user: { sub: string; store_id: string | null },
    @Body() dto: CreateManyProductsDto,
  ) {
    return this.productService.createMany(user, dto.products);
  }
  /**
   * 9️⃣ Update product
   */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productService.update(id, dto);
  }

  /**
   * 🔟 Delete product
   */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productService.remove(id);
  }
}
