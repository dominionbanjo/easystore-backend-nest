import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreAnalyticsService } from './services/store-analytics.service';
import { StoreAnalyticsController } from './controllers/store-analytics.controller';
import { StoreAnalytics } from './entities/store-analytics.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { StoreModule } from '../store/store.module';
import { StoreMonthlyAnalytics } from './entities/store_monthly_analytics.entity';
import { StoreCustomer } from './entities/store_customers.entity';

import { StoreCustomersController } from './controllers/store-customers.controller';
import { StoreCustomersService } from './services/store-customers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StoreAnalytics,
      User,
      StoreMonthlyAnalytics,
      StoreCustomer,
    ]),
    CacheModule,
    forwardRef(() => StoreModule), // ✅ ADD THIS
  ],
  controllers: [StoreAnalyticsController, StoreCustomersController],
  providers: [StoreAnalyticsService, StoreCustomersService],
  exports: [StoreAnalyticsService, StoreCustomersService], // ✅ IMPORTANT
})
export class StoreAnalyticsModule {}
