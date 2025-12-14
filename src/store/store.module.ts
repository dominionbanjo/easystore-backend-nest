import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StoreService } from './store.service';
import { StoreController } from './controllers/store.controller';

import { Store } from './entities/store.entity';
import { Product } from 'src/product/entities/product.entity';
import { User } from 'src/users/entities/user.entity';

import { CacheModule } from 'src/cache/cache.module';
import { CommonModule } from 'src/common/common.module'; // <-- your module

import { StoreOwnerGuard } from './guards/store-owner.guard';
import { StoreLookupController } from './controllers/store-lookup.controller';
import { StoreAdminController } from './controllers/store-admin.controller';
import { ProductCategory } from 'src/product-category/entities/product-category.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Store, Product, User, ProductCategory]),
    CacheModule,
    CommonModule,
  ],
  controllers: [StoreController, StoreLookupController, StoreAdminController],
  providers: [StoreService, StoreOwnerGuard], // 👈 ensure guard is here
  exports: [
    StoreService,
    StoreOwnerGuard, // ✅ EXPORT IT
    TypeOrmModule, // ✅ ALSO export repositories
  ],
})
export class StoreModule {}
