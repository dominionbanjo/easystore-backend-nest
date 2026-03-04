import { Injectable } from '@nestjs/common';
import { ProductReadService } from './product-read.service';
import { ProductWriteService } from './product-write.service';
import { ProductSearchService } from './product-search.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { ProductSearchDto } from '../dto/product-search.dto';
import { ProductStatus } from '../entities/product.entity';
import { CreateProductCloudinaryDto } from '../dto/create-product-cloudinary.dto';
import { UpdateProductCloudinaryDto } from '../dto/update-product-cloudinary.dto';

@Injectable()
export class ProductService {
  constructor(
    private readonly readService: ProductReadService,
    private readonly writeService: ProductWriteService,
    private readonly searchService: ProductSearchService,
  ) {}

  /* ────────────────────────────────────────────────
     READ OPERATIONS
  ──────────────────────────────────────────────── */
  getProductsGroupedByCategory(
    pagination?: PaginationQueryDto,
    userId?: string,
  ) {
    return this.readService.getProductsGroupedByCategory(pagination, userId);
  }

  getFeaturedProducts(pagination?: PaginationQueryDto, userId?: string) {
    return this.readService.getFeaturedProducts(pagination, userId);
  }

  getAllProducts(pagination?: PaginationQueryDto, userId?: string) {
    return this.readService.getAllProducts(pagination, userId);
  }

  getProductsByCategory(
    identifier: string,
    pagination?: PaginationQueryDto,
    userId?: string,
  ) {
    return this.readService.getProductsByCategory(
      identifier,
      pagination,
      userId,
    );
  }

  getSingle(identifier: string, userId?: string) {
    return this.readService.getSingle(identifier, userId);
  }

  getByStore(storeId: string, pagination?: PaginationQueryDto) {
    return this.readService.getByStore(storeId, pagination);
  }

  /* ────────────────────────────────────────────────
     SEARCH OPERATIONS
  ──────────────────────────────────────────────── */
  search(params: ProductSearchDto) {
    return this.searchService.search(params);
  }

  searchStoreProducts(
    storeId: string,
    params: ProductSearchDto,
    userId?: string,
  ) {
    return this.searchService.searchStoreProducts(storeId, params, userId);
  }

  searchStoreProductsEntity(
    storeId: string,
    params: ProductSearchDto,
    pagination?: PaginationQueryDto,
  ) {
    return this.searchService.searchStoreProductsEntity(
      storeId,
      params,
      pagination,
    );
  }

  getVendorProducts(storeId: string, params: ProductSearchDto) {
    return this.searchService.getVendorProducts(storeId, params);
  }

  /* ────────────────────────────────────────────────
     WRITE OPERATIONS
  ──────────────────────────────────────────────── */
  create(user: any, dto: CreateProductDto, files?: any) {
    return this.writeService.create(user, dto, files);
  }

  createWithCloudinary(user: any, dto: CreateProductCloudinaryDto) {
    return this.writeService.createWithCloudinary(user, dto);
  }

  createMany(user: any, dtos: CreateProductDto[]) {
    return this.writeService.createMany(user, dtos);
  }

  update(id: string, dto: UpdateProductDto) {
    return this.writeService.update(id, dto);
  }

  updateWithCloudinary(id: string, dto: UpdateProductCloudinaryDto) {
    return this.writeService.updateWithCloudinary(id, dto);
  }

  updateStatus(productId: string, status: ProductStatus) {
    return this.writeService.updateStatus(productId, status);
  }

  updateOnSale(productId: string, onSale: boolean) {
    return this.writeService.updateOnSale(productId, onSale);
  }

  remove(id: string) {
    return this.writeService.remove(id);
  }

  adjustStock(productId: string, adjustment: number, manager?: any) {
    return this.writeService.adjustStock(productId, adjustment, manager);
  }

  adjustVariantStock(variantId: string, adjustment: number, manager?: any) {
    return this.writeService.adjustVariantStock(variantId, adjustment, manager);
  }
}
