import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { StoreReadService } from './store-read.service';
import { StoreWriteService } from './store-write.service';
import { PaginationQueryDto as PaginationDto } from 'src/common/dto/pagination.dto';
import { CreateStoreDto } from '../dto/create-store.dto';

@Injectable()
export class StoreService {
  constructor(
    private readonly readService: StoreReadService,
    private readonly writeService: StoreWriteService,
  ) {}

  /* ────────────────────────────────────────────────
     READ OPERATIONS
  ──────────────────────────────────────────────── */
  searchStores(q: string, pagination?: PaginationDto) {
    return this.readService.searchStores(q, pagination);
  }

  getStore(identifier: string, options?: any) {
    return this.readService.getStore(identifier, options);
  }

  getStoreByUser(userId: string) {
    return this.readService.getStoreByUser(userId);
  }

  getAllStores(pagination?: PaginationDto) {
    return this.readService.getAllStores(pagination);
  }

  getAllStoresAdmin(pagination?: PaginationDto) {
    return this.readService.getAllStoresAdmin(pagination);
  }

  getTotalProductsForStore(storeId: string) {
    return this.readService.getTotalProductsForStore(storeId);
  }

  getStoreProducts(
    identifier: string,
    pagination?: PaginationDto,
    userId?: string,
  ) {
    return this.readService.getStoreProducts(identifier, pagination, userId);
  }

  getStoreProductsByCategory(
    identifier: string,
    categoryId: string,
    pagination?: PaginationDto,
    userId?: string,
  ) {
    return this.readService.getStoreProductsByCategory(
      identifier,
      categoryId,
      pagination,
      userId,
    );
  }

  getStoreProductsGroupedByCategory(
    identifier: string,
    pagination?: PaginationDto,
    userId?: string,
  ) {
    return this.readService.getStoreProductsGroupedByCategory(
      identifier,
      pagination,
      userId,
    );
  }

  validateVendorForOnline(userId: string) {
    return this.readService.validateVendorForOnline(userId);
  }

  isStoreOwner(storeId: string, userId: string): Promise<boolean> {
    return this.readService.isStoreOwner(storeId, userId);
  }

  /* ────────────────────────────────────────────────
     WRITE OPERATIONS
  ──────────────────────────────────────────────── */
  createStore(data: CreateStoreDto, manager?: EntityManager) {
    return this.writeService.createStore(data, manager);
  }

  updateStore(storeId: string, data: any, files?: any) {
    return this.writeService.updateStore(storeId, data, files);
  }

  deleteStore(storeId: string) {
    return this.writeService.deleteStore(storeId);
  }

  storeNameExists(name: string) {
    return this.writeService.storeNameExists(name);
  }

  registerBankAccount(
    storeId: string,
    bank_code: string,
    account_number: string,
    settlement_email?: string,
  ) {
    return this.writeService.registerBankAccount(
      storeId,
      bank_code,
      account_number,
      settlement_email,
    );
  }

  updateBankAccount(storeId: string, updates: any) {
    return this.writeService.updateBankAccount(storeId, updates);
  }

  deleteBankAccount(storeId: string) {
    return this.writeService.deleteBankAccount(storeId);
  }
}
