import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Escrow } from 'src/modules/finance-module/escrow/entities/escrow.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import { EscrowModule } from 'src/modules/finance-module/escrow/escrow.module';
import { TransactionsModule } from 'src/modules/finance-module/transactions/transactions.module';
import { CacheModule } from 'src/modules/shared-module/cache/cache.module';
import { EmailModule } from 'src/modules/shared-module/email/email.module';
import { DeliveryModule } from 'src/modules/commerce-module/delivery/delivery.module';
import { ProductModule } from 'src/modules/commerce-module/product/product.module';
import { InstallmentPlan } from './entities/installment-plan.entity';
import { InstallmentPayment } from './entities/installment-payment.entity';
import { InstallmentService } from './services/installment.service';
import { InstallmentCronService } from './services/installment-cron.service';
import { InstallmentsController } from './controllers/installments.controller';
import { VendorInstallmentsController } from './controllers/vendor-installments.controller';
import { AdminInstallmentsController } from './controllers/admin-installments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InstallmentPlan,
      InstallmentPayment,
      Order,
      User,
      Escrow,
      Store,
    ]),
    CommonModule,
    EscrowModule,
    TransactionsModule,
    CacheModule,
    EmailModule,
    DeliveryModule,
    ProductModule,
  ],
  controllers: [
    InstallmentsController,
    VendorInstallmentsController,
    AdminInstallmentsController,
  ],
  providers: [InstallmentService, InstallmentCronService],
  exports: [InstallmentService],
})
export class InstallmentModule {}
