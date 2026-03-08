import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { Transaction } from 'src/modules/finance-module/transactions/entities/transaction.entity';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminTransactionsController } from './controllers/admin-transactions.controller';
import { AdminTransactionsService } from './services/admin-transactions.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Store, Transaction])],
  controllers: [AdminUsersController, AdminTransactionsController],
  providers: [AdminUsersService, AdminTransactionsService],
})
export class AdminModule {}
