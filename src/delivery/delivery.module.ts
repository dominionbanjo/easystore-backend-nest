import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Delivery } from './entities/delivery.entity';
import { Order } from 'src/order/entities/order.entity';
import { User } from 'src/users/entities/user.entity';

import { DeliveryService } from './delivery.service';
import { DeliveryController } from './delivery.controller';

import { EscrowModule } from 'src/escrow/escrow.module';
import { CacheModule } from 'src/cache/cache.module';
import { EmailModule } from 'src/email/email.module';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    /* 🔑 REPOSITORIES */
    TypeOrmModule.forFeature([Delivery, Order, User]),
    CommonModule,
    /* 🔑 DEPENDENCY MODULES */
    EscrowModule,
    CacheModule,
    EmailModule,
  ],
  controllers: [DeliveryController],
  providers: [DeliveryService],
  exports: [DeliveryService],
})
export class DeliveryModule {}
