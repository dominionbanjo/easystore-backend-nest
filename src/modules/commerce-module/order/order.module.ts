import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from './entities/order.entity';
import { OrderService } from './services/order.service';
import { OrderQueryService } from './services/order-query.service';
import { OrderManagementService } from './services/order-management.service';
import { OrderPaymentVerificationService } from './services/order-payment-verification.service';
import { OrderValidationService } from './services/order-validation.service';
import { OnlineOrderService } from './services/online-order.service';
import { OfflineOrderService } from './services/offline-order.service';
import { PandaOrderService } from './services/panda-order.service';
import { OrderSummaryService } from './services/order-summary.service';
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
import { StoreStaff } from 'src/modules/vendor-module/store/entities/store-staff.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { ProductCustomer } from '../product/entities/product-customer.entity';
import { OrderPaymentController } from './controllers/order-payment.controller';
import { OrderController } from './controllers/pandaOrder.controller';
import { PandaOrderController } from './controllers/order.controller';
import { OrderPaymentService } from './services/order-payment-webhook.service';
import { ReceiptService } from './services/receipt.service';
import { CartModule } from '../cart/cart.module';
import { StoreAnalyticsModule } from 'src/modules/vendor-module/store-analytics/store-analytics.module';
import { OrderCronService } from './services/order-cron.service';
import { InstallmentModule } from 'src/modules/finance-module/installment/installment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, User, ProductCustomer, StoreStaff, Store]),
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
    StoreAnalyticsModule,
    InstallmentModule,
  ],
  controllers: [OrderController, PandaOrderController, OrderPaymentController],
  providers: [
    // Main orchestrator service
    OrderService,

    // Specialized services
    OrderQueryService,
    OrderManagementService,
    OrderPaymentVerificationService,
    OrderValidationService,
    OnlineOrderService,
    OfflineOrderService,
    PandaOrderService,
    OrderSummaryService,

    // Supporting services
    PandascrowEscrowService,
    OrderPaymentService,
    OrderCronService,
    ReceiptService,
  ],
  exports: [OrderService, ReceiptService],
})
export class OrderModule {}
