import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from 'src/modules/shared-module/email/email.module';
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
import { StoreStaff } from './entities/store-staff.entity';
import { StoreTemplate } from './entities/store-template.entity';
import { ThemeSetting } from './entities/theme-setting.entity';
import { ProductColor } from 'src/modules/shared-module/colors/entities/color.entity';
import { Wishlist } from 'src/modules/commerce-module/wishlist/entities/wishlist.entity';
import { StoreDeliveryRateController } from './controllers/store-delivery-rate.controller';
import { StoreStaffController } from './controllers/store-staff.controller';
import { StoreDeliveryRateService } from 'src/modules/vendor-module/store/services/store-delivery-rate.service';
import { StoreStaffService } from './services/store-staff.service';
import { StaffInviteMailService } from 'src/modules/shared-module/email/services/staff-invite-mail.service';
import { StoreService } from './services/store.service';
import { StoreReadService } from './services/store-read.service';
import { StoreWriteService } from './services/store-write.service';
import { StoreHelperService } from './services/store-helper.service';
import { ThemeSeederService } from './services/theme-seeder.service';
import { VendorAwarenessCronService } from './services/vendor-awareness-cron.service';
import { StoreCatalogService } from './services/store-catalog.service';
import { StoreDetailService } from './services/store-detail.service';
import { StoreThemeService } from './services/store-theme.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Store,
      StoreStaff,
      StoreTemplate,
      ThemeSetting,
      Product,
      StoreDeliveryRate,
      User,
      ProductCategory,
      ProductColor,
      Wishlist,
    ]),
    CacheModule,
    CommonModule,
    EmailModule,
    forwardRef(() => StoreAnalyticsModule),
  ],
  controllers: [
    StoreStaffController,
    StoreLookupController,
    StoreAdminController,
    StoreDeliveryRateController,
    StoreController,
  ],
  providers: [
    StoreService,
    StoreReadService,
    StoreWriteService,
    StoreHelperService,
    ThemeSeederService,
    StoreOwnerGuard,
    StoreDeliveryRateService,
    VendorAwarenessCronService,
    StoreCatalogService,
    StoreDetailService,
    StoreThemeService,
    StoreStaffService,
    StaffInviteMailService,
  ],
  exports: [
    StoreService,
    StoreReadService,
    StoreWriteService,
    StoreOwnerGuard,
    StoreDeliveryRateService,
    StoreCatalogService,
    StoreDetailService,
    StoreThemeService,
  ],
})
export class StoreModule {}
