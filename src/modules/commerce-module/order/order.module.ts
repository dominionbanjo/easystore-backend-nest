import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from './entities/order.entity';
import { OrderService } from './services/order.service';
import { CommonModule } from 'src/common/common.module';
import { EscrowModule } from 'src/modules/finance-module/escrow/escrow.module';
import { TransactionsModule } from 'src/modules/finance-module/transactions/transactions.module';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { EmailModule } from 'src/modules/shared-module/email/email.module';
import { StoreModule } from 'src/modules/vendor-module/store/store.module';
import { DeliveryModule } from '../delivery/delivery.module';
import { ProductModule } from '../product/product.module';
import { PandascrowEscrowService } from './services/pandascrow-escrow.service';
import { HttpModule } from '@nestjs/axios';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { OrderPaymentController } from './controllers/order-payment.controller';
import { OrderController } from './controllers/pandaOrder.controller';
import { PandaOrderController } from './controllers/order.controller';
import { OrderPaymentService } from './services/order-payment-webhook.service';
import { CartModule } from '../cart/cart.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User]),
    HttpModule,
    ProductModule,
    CacheModule,
    EmailModule,
    DeliveryModule,
    EscrowModule,
    TransactionsModule,
    CommonModule,
    StoreModule,
    CartModule,
  ],
  controllers: [OrderController, PandaOrderController, OrderPaymentController],
  providers: [OrderService, PandascrowEscrowService, OrderPaymentService],
  exports: [OrderService],
})
export class OrderModule {}
