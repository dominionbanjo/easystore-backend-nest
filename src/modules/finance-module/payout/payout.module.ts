import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payout } from './entities/payout.entity';
import { PayoutService } from './payout.service';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payout]),

    CacheModule,
    TransactionsModule, //
  ],
  providers: [PayoutService],
  exports: [PayoutService],
})
export class PayoutModule {}
