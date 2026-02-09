import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
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
import { StoreDeliveryRate } from './entities/store-delivery-rate.entity';
import { ProductColor } from 'src/modules/shared-module/colors/entities/color.entity';
import { Wishlist } from 'src/modules/commerce-module/wishlist/entities/wishlist.entity';
import { StoreDeliveryRateController } from './controllers/store-delivery-rate.controller';
import { StoreDeliveryRateService } from 'src/modules/vendor-module/store/services/store-delivery-rate.service';
import { StoreService } from './services/store.service';
import { StoreReadService } from './services/store-read.service';
import { StoreWriteService } from './services/store-write.service';
import { StoreHelperService } from './services/store-helper.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Store,
      Product,
      StoreDeliveryRate,
      User,
      ProductCategory,
      ProductColor,
      Wishlist,
    ]),
    CacheModule,
    CommonModule,
    forwardRef(() => StoreAnalyticsModule), // ✅ ADD THIS
  ],
  controllers: [
    StoreController,
    StoreLookupController,
    StoreAdminController,
    StoreDeliveryRateController,
  ],
  providers: [
    StoreService,
    StoreReadService,
    StoreWriteService,
    StoreHelperService,
    StoreOwnerGuard,
    StoreDeliveryRateService,
  ],
  exports: [StoreService, StoreReadService, StoreWriteService, StoreOwnerGuard],
})
export class StoreModule {}
