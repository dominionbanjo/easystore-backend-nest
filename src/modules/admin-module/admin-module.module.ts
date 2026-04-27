import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { Transaction } from 'src/modules/finance-module/transactions/entities/transaction.entity';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { Product } from 'src/modules/commerce-module/product/entities/product.entity';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Store,
      Transaction,
      Order,
      Product,
      Broadcast,
    ]),
    EmailModule,
  ],
  controllers: [
    AdminUsersController,
    AdminTransactionsController,
    AdminAnalyticsController,
    AdminBroadcastController,
  ],
  providers: [
    AdminUsersService,
    AdminTransactionsService,
    AdminAnalyticsService,
    AdminBroadcastService,
  ],
})
export class AdminModule {}
