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

import { StoreService } from '../store.service';
import { UpdateStoreDto } from '../dto/update-store.dto';
import { CreateStorePublicDto } from '../dto/create-pstore.dto';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { StoreOwnerGuard } from '../guards/store-owner.guard';
import * as jwtStrategy from 'src/auth/strategies/jwt.strategy';

@Controller('store')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  /* ────────────────────────────────────────────────
     PUBLIC STORE ROUTES
  ──────────────────────────────────────────────── */

  // GET /store
  @Get()
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.storeService.getAllStores(pagination);
  }

  // GET /store/:identifier/products
  @Get(':identifier/products')
  getStoreProducts(
    @Param('identifier') identifier: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.storeService.getStoreProducts(identifier, pagination);
  }
  // GET /store/:identifier
  @Get(':identifier')
  findOne(
    @Param('identifier') identifier: string,
    @Query('includeProducts') includeProducts?: string,
    @Query('includeCategories') includeCategories?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storeService.getStore(identifier, {
      includeProducts: includeProducts === 'true',
      includeCategories: includeCategories !== 'false', // default true
      productPage: page ? Number(page) : 1,
      productLimit: limit ? Number(limit) : 20,
    });
  }

  // GET /store/:identifier/products/grouped-by-category
  @Get(':identifier/products/grouped-by-category')
  getStoreProductsGroupedByCategory(
    @Param('identifier') identifier: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.storeService.getStoreProductsGroupedByCategory(
      identifier,
      pagination,
    );
  }

  /* ────────────────────────────────────────────────
     CREATE STORE
  ──────────────────────────────────────────────── */

  // POST /store
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  create(
    @CurrentUser() user: jwtStrategy.JwtAuthUser,
    @Body() dto: CreateStorePublicDto,
  ) {
    return this.storeService.createStorePublic(user.sub, dto);
  }

  /* ────────────────────────────────────────────────
     UPDATE / DELETE STORE
  ──────────────────────────────────────────────── */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, StoreOwnerGuard)
  @Roles('vendor', 'admin')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'cover_image', maxCount: 1 },
    ]),
  )
  update(
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

  // DELETE /store/:id
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard, StoreOwnerGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.storeService.deleteStore(id);
  }

  /* ────────────────────────────────────────────────
     BANK ROUTES (STORE SUB-RESOURCE)
  ──────────────────────────────────────────────── */

  // POST /store/:id/bank
  @Post(':id/bank')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor', 'admin')
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

  // PATCH /store/:id/bank
  @Patch(':id/bank')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor', 'admin')
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

  // DELETE /store/:id/bank
  @Delete(':id/bank')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('vendor', 'admin')
  removeBank(@Param('id') storeId: string) {
    return this.storeService.deleteBankAccount(storeId);
  }
}
