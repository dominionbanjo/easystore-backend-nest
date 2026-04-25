import { Injectable } from '@nestjs/common';
import { PaginationQueryDto as PaginationDto } from 'src/common/dto/pagination.dto';
import { StoreCatalogService } from './store-catalog.service';
import { StoreDetailService } from './store-detail.service';
import { StoreThemeService } from './store-theme.service';

/**
 * StoreReadService - Facade for store reading operations.
 * Delegates to specialized services to maintain backward compatibility.
 */
@Injectable()
export class StoreReadService {
  constructor(
    private readonly catalogService: StoreCatalogService,
    private readonly detailService: StoreDetailService,
    private readonly themeService: StoreThemeService,
  ) {}

  searchStores(q: string, pagination?: PaginationDto) {
    return this.catalogService.searchStores(q, pagination);
  }

  getStore(identifier: string, options?: any) {
    return this.detailService.getStore(identifier, options);
  }

  getStoreByUser(userId: string) {
    return this.detailService.getStoreByUser(userId);
  }

  getAllStores(pagination?: PaginationDto) {
    return this.catalogService.getAllStores(pagination);
  }

  getAllStoresAdmin(pagination?: PaginationDto) {
    return this.catalogService.getAllStoresAdmin(pagination);
  }

  getTotalProductsForStore(storeId: string) {
    return this.detailService.getTotalProductsForStore(storeId);
  }

  getStoreProducts(identifier: string, pagination?: PaginationDto, userId?: string) {
    return this.detailService.getStoreProducts(identifier, pagination, userId);
  }

  getStoreProductsByCategory(identifier: string, categoryId: string, pagination?: PaginationDto, userId?: string) {
    return this.detailService.getStoreProductsByCategory(identifier, categoryId, pagination, userId);
  }

  getStoreProductsGroupedByCategory(identifier: string, pagination?: PaginationDto, userId?: string) {
    return this.detailService.getStoreProductsGroupedByCategory(identifier, pagination, userId);
  }

  validateVendorForOnline(userId: string) {
    return this.detailService.validateVendorForOnline(userId);
  }

  isStoreOwner(storeId: string, userId: string) {
    return this.detailService.isStoreOwner(storeId, userId);
  }

  getTemplates() {
    return this.themeService.getTemplates();
  }

  getStoreTheme(slug: string) {
    return this.themeService.getStoreTheme(slug);
  }
}
