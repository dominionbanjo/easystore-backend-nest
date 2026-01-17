import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from './entities/order.entity';
import { OrderService } from './services/order.service';
import { OrderController } from './controllers/order.controller';
import { CommonModule } from 'src/common/common.module';
import { EscrowModule } from 'src/modules/finance-module/escrow/escrow.module';
import { TransactionsModule } from 'src/modules/finance-module/transactions/transactions.module';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { EmailModule } from 'src/modules/shared-module/email/email.module';
import { StoreModule } from 'src/modules/vendor-module/store/store.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order]),
    ProductModule,
    CacheModule,
    EmailModule,
    DeliveryModule,
    EscrowModule,
    TransactionsModule,
    CommonModule,
    StoreModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
