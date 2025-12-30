import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Escrow } from './entities/escrow.entity';
import { Order } from 'src/order/entities/order.entity';
import { EscrowService } from './escrow.service';

import { CommonModule } from 'src/common/common.module';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { UsersModule } from 'src/users/users.module';
import { EmailModule } from 'src/email/email.module';
import { StoreModule } from 'src/store/store.module';
import { CacheModule } from 'src/cache/cache.module';
import { PayoutModule } from 'src/payout/payout.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escrow, Order]),

    CommonModule,
    TransactionsModule,
    UsersModule,
    EmailModule,
    StoreModule,
    CacheModule,
    PayoutModule,
  ],
  providers: [EscrowService],
  exports: [EscrowService],
})
export class EscrowModule {}
