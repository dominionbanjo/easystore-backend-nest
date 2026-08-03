import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { Transaction } from 'src/modules/finance-module/transactions/entities/transaction.entity';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { Product } from 'src/modules/commerce-module/product/entities/product.entity';
import { Payout } from 'src/modules/finance-module/payout/entities/payout.entity';
import { Escrow } from 'src/modules/finance-module/escrow/entities/escrow.entity';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminTransactionsController } from './controllers/admin-transactions.controller';
import { AdminTransactionsService } from './services/admin-transactions.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { EmailModule } from 'src/modules/shared-module/email/email.module';
import { Broadcast } from './entities/broadcast.entity';
import { AdminBroadcastController } from './controllers/admin-broadcast.controller';
import { AdminBroadcastService } from './services/admin-broadcast.service';
import { AdminAnalyticsController } from './controllers/admin-analytics.controller';
import { AdminEscrowController } from './controllers/admin-escrow.controller';
import { AdminEscrowService } from './services/admin-escrow.service';
import { AdminOrderService } from './services/admin-order.service';
import { PayoutModule } from 'src/modules/finance-module/payout/payout.module';
import { UsersModule } from 'src/modules/identity-module/users/users.module';
import { StoreModule } from 'src/modules/vendor-module/store/store.module';
import { AdminOrderController } from './controllers/admin-order.controller';
import { OrderModule } from 'src/modules/commerce-module/order/order.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Store,
      Transaction,
      Order,
      Product,
      Broadcast,
      Payout,
      Escrow,
    ]),
    EmailModule,
    PayoutModule,
    UsersModule,
    StoreModule,
    OrderModule,
  ],
  controllers: [
    AdminUsersController,
    AdminTransactionsController,
    AdminAnalyticsController,
    AdminBroadcastController,
    AdminEscrowController,
    AdminOrderController,
  ],
  providers: [
    AdminUsersService,
    AdminTransactionsService,
    AdminAnalyticsService,
    AdminBroadcastService,
    AdminEscrowService,
    AdminOrderService,
  ],
})
export class AdminModule {}
