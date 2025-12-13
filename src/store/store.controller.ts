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
  BadRequestException,
} from '@nestjs/common';

import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

import { PaginationQueryDto as PaginationDto } from 'src/common/dto/pagination.dto';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  // ---------------------------------------
  // CREATE STORE
  // ---------------------------------------
  @Post()
  create(@Body() dto: CreateStoreDto) {
    return this.storeService.createStore(dto);
  }

  // ---------------------------------------
  // GET ALL STORES (PUBLIC)
  // ---------------------------------------
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.storeService.getAllStores(pagination);
  }

  // ---------------------------------------
  // GET STORE BY ID OR SLUG
  // ---------------------------------------
  @Get(':identifier')
  findOne(@Param('identifier') identifier: string) {
    return this.storeService.getStore(identifier);
  }

  // ---------------------------------------
  // GET STORE PRODUCTS (PAGINATED)
  // ---------------------------------------
  @Get(':identifier/products')
  getStoreProducts(
    @Param('identifier') identifier: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.storeService.getStoreProducts(identifier, pagination);
  }

  // ---------------------------------------
  // ADMIN: GET ALL STORES
  // ---------------------------------------
  @Get('admin/list/all')
  getAllAdmin(@Query() pagination: PaginationDto) {
    return this.storeService.getAllStoresAdmin(pagination);
  }

  // ---------------------------------------
  // UPDATE STORE (WITH OPTIONAL FILE UPLOAD)
  // ---------------------------------------
  @Patch(':id')
  @UseInterceptors(FilesInterceptor('files'))
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStoreDto,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    return this.storeService.updateStore(id, dto, files);
  }

  // ---------------------------------------
  // DELETE STORE
  // ---------------------------------------
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.storeService.deleteStore(id);
  }

  // ---------------------------------------
  // GET ANALYTICS
  // ---------------------------------------
  @Get(':id/analytics')
  getAnalytics(
    @Param('id') storeId: string,
    @Query('userId') userId: string,
    @Query('role') role: string,
  ) {
    if (!userId || !role) {
      throw new BadRequestException('userId and role are required');
    }
    return this.storeService.getAnalytics(storeId, userId, role);
  }

  // ---------------------------------------
  // REGISTER BANK ACCOUNT
  // ---------------------------------------
  @Post(':id/bank')
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

  // ---------------------------------------
  // UPDATE BANK ACCOUNT
  // ---------------------------------------
  @Patch(':id/bank')
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

  // ---------------------------------------
  // DELETE BANK ACCOUNT
  // ---------------------------------------
  @Delete(':id/bank')
  removeBank(@Param('id') storeId: string) {
    return this.storeService.deleteBankAccount(storeId);
  }
}
