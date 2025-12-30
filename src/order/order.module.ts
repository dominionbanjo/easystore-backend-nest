import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from './entities/order.entity';
import { OrderService } from './services/order.service';
import { OrderController } from './controllers/order.controller';

import { ProductModule } from 'src/product/product.module';
import { CacheModule } from 'src/cache/cache.module';
import { EmailModule } from 'src/email/email.module';
import { DeliveryModule } from 'src/delivery/delivery.module';
import { EscrowModule } from 'src/escrow/escrow.module';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { CommonModule } from 'src/common/common.module';
import { StoreModule } from 'src/store/store.module';

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
