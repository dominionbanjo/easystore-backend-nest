import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreAnalyticsService } from './store-analytics.service';
import { StoreAnalyticsController } from './store-analytics.controller';
import { StoreAnalytics } from './entities/store-analytics.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { StoreModule } from '../store/store.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([StoreAnalytics, User]),
    CacheModule,
    StoreModule, // ✅ REQUIRED
  ],
  controllers: [StoreAnalyticsController],
  providers: [StoreAnalyticsService],
})
export class StoreAnalyticsModule {}
