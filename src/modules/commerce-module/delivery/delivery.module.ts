import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Delivery } from './entities/delivery.entity';
import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';
import { CommonModule } from 'src/common/common.module';
import { EscrowModule } from 'src/modules/finance-module/escrow/escrow.module';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { EmailModule } from 'src/modules/shared-module/email/email.module';
import { Order } from '../order/entities/order.entity';
import { StoreAnalyticsModule } from 'src/modules/vendor-module/store-analytics/store-analytics.module';

@Module({
  imports: [
    /* 🔑 REPOSITORIES */
    TypeOrmModule.forFeature([Delivery, Order, User]),
    CommonModule,
    /* 🔑 DEPENDENCY MODULES */
    EscrowModule,
    CacheModule,
    EmailModule,
    StoreAnalyticsModule,
  ],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
