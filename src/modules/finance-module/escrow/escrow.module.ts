import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Escrow } from './entities/escrow.entity';
import { CommonModule } from 'src/common/common.module';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { UsersModule } from 'src/modules/identity-module/users/users.module';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { EmailModule } from 'src/modules/shared-module/email/email.module';
import { StoreModule } from 'src/modules/vendor-module/store/store.module';
import { PayoutModule } from '../payout/payout.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { EscrowService } from './escrow.service';

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
