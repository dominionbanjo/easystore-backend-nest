import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payout } from './entities/payout.entity';
import { PayoutService } from './payout.service';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';

import { PayoutController } from './payout.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payout, Order]),

    CacheModule,
    TransactionsModule,
  ],
  controllers: [PayoutController],
  providers: [PayoutService],
  exports: [PayoutService],
})
export class PayoutModule {}
