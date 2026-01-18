import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreService } from './store.service';
import { StoreController } from './controllers/store.controller';
import { Store } from './entities/store.entity';
import { CommonModule } from 'src/common/common.module';
import { ProductCategory } from 'src/modules/commerce-module/product-category/entities/product-category.entity';
import { Product } from 'src/modules/commerce-module/product/entities/product.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { StoreAdminController } from './controllers/store-admin.controller';
import { StoreLookupController } from './controllers/store-lookup.controller';
import { StoreOwnerGuard } from './guards/store-owner.guard';
import { StoreAnalyticsModule } from '../store-analytics/store-analytics.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Store, Product, User, ProductCategory]),
    CacheModule,
    CommonModule,
    forwardRef(() => StoreAnalyticsModule), // ✅ ADD THIS
  ],
  controllers: [StoreController, StoreLookupController, StoreAdminController],
  providers: [StoreService, StoreOwnerGuard],
  exports: [StoreService, StoreOwnerGuard],
})
export class StoreModule {}
