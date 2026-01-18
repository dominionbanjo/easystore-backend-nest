import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreAnalyticsService } from './store-analytics.service';
import { StoreAnalyticsController } from './store-analytics.controller';
import { StoreAnalytics } from './entities/store-analytics.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { StoreModule } from '../store/store.module';
import { StoreMonthlyAnalytics } from './entities/store_monthly_analytics.entity';
import { StoreCustomer } from './entities/store_customers.entity';

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
  controllers: [StoreAnalyticsController],
  providers: [StoreAnalyticsService],
  exports: [StoreAnalyticsService], // ✅ IMPORTANT
})
export class StoreAnalyticsModule {}
