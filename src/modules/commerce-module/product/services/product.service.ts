import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProductReadService } from './product-read.service';
import { ProductWriteService } from './product-write.service';
import { ProductSearchService } from './product-search.service';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { ProductSearchDto } from '../dto/product-search.dto';
import { ProductStatus } from '../entities/product.entity';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { SaveProductDraftDto } from '../dto/save-product-draft.dto';

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

  getByStore(
    storeId: string,
    pagination?: PaginationQueryDto,
    userId?: string,
  ) {
    return this.readService.getByStore(storeId, pagination, userId);
  }

  getVendorSingle(identifier: string, storeId: string) {
    return this.readService.getVendorSingle(identifier, storeId);
  }

  lookupByBarcode(barcode: string, storeId: string) {
    return this.readService.lookupByBarcode(barcode, storeId);
  }

  /* ────────────────────────────────────────────────
     SEARCH OPERATIONS
  ──────────────────────────────────────────────── */
  search(params: ProductSearchDto, userId?: string) {
    return this.searchService.search(params, userId);
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

  getSalesTerminalProducts(
    storeId: string,
    query?: { page?: number; limit?: number; q?: string; category?: string },
  ) {
    return this.searchService.getSalesTerminalProducts(storeId, query);
  }

  getSalesTerminalCategories(storeId: string) {
    return this.searchService.getSalesTerminalCategories(storeId);
  }

  /* ────────────────────────────────────────────────
     WRITE OPERATIONS
  ──────────────────────────────────────────────── */
  create(
    user: { sub: string; store_id: string | null },
    dto: CreateProductDto,
  ) {
    return this.writeService.create(user, dto);
  }

  update(id: string, dto: UpdateProductDto) {
    return this.writeService.update(id, dto);
  }

  updateStatus(productId: string, status: ProductStatus) {
    return this.writeService.updateStatus(productId, status);
  }

  updateOnSale(productId: string, onSale: boolean) {
    return this.writeService.updateOnSale(productId, onSale);
  }

  saveDraft(
    user: { sub: string; store_id: string | null },
    dto: SaveProductDraftDto,
  ) {
    return this.writeService.saveDraft(user, dto);
  }

  publishDraft(
    user: { sub: string; store_id: string | null },
    draftId: string,
    dto: CreateProductDto,
  ) {
    return this.writeService.publishDraft(user, draftId, dto);
  }

  discardDraft(
    user: { sub: string; store_id: string | null },
    draftId: string,
  ) {
    return this.writeService.discardDraft(user, draftId);
  }

  getVendorDrafts(storeId: string, params: ProductSearchDto) {
    return this.readService.getVendorDrafts(storeId, params);
  }

  getVendorDraft(storeId: string, id: string) {
    return this.readService.getVendorDraft(storeId, id);
  }

  remove(id: string) {
    return this.writeService.remove(id);
  }

  adjustStock(productId: string, adjustment: number, manager?: EntityManager) {
    return this.writeService.adjustStock(productId, adjustment, manager);
  }

  adjustVariantStock(
    variantId: string,
    adjustment: number,
    manager?: EntityManager,
  ) {
    return this.writeService.adjustVariantStock(variantId, adjustment, manager);
  }
}
