import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { OrderMailService } from './services/order-mail.service';
import { DeliveryMailService } from './services/delivery-mail.service';
import { EmailVerificationService } from './services/email-verification.service';
import { EscrowMailService } from './services/escrow-mail.service';
import { WelcomeMailService } from './services/welcome-mail.service';
import { ResetPasswordMailService } from './services/reset-password-mail.service';
import { AdminNotifyMailService } from './services/admin-notify-mail.service';
import { AccountStatusMailService } from './services/account-status-mail.service';
import { StoreWelcomeMailService } from './services/store-welcome-mail.service';
import { VendorAwarenessMailService } from './services/vendor-awareness-mail.service';
import { BuyerEngagementMailService } from './services/buyer-engagement-mail.service';
import { StaffInviteMailService } from './services/staff-invite-mail.service';
import { InstallmentMailService } from './services/installment-mail.service';
import { EmailLog } from './entities/email-log.entity';
import { EmailRetryService } from './services/email-retry.service';

@Module({
  imports: [TypeOrmModule.forFeature([EmailLog])],
  providers: [
    EmailService,
    EmailTemplateService,
    EmailRetryService,

    // Mailers
    OrderMailService,
    DeliveryMailService,
    EscrowMailService,
    EmailVerificationService,
    WelcomeMailService,
    ResetPasswordMailService,
    AdminNotifyMailService,
    AccountStatusMailService,
    StoreWelcomeMailService,
    VendorAwarenessMailService,
    BuyerEngagementMailService,
    StaffInviteMailService,
    InstallmentMailService,
  ],

  exports: [
    EmailService,
    EmailTemplateService,

    // Export all mailers so other modules can use them
    OrderMailService,
    DeliveryMailService,
    EscrowMailService,
    EmailVerificationService,
    WelcomeMailService,
    ResetPasswordMailService,
    AdminNotifyMailService,
    AccountStatusMailService,
    StoreWelcomeMailService,
    VendorAwarenessMailService,
    BuyerEngagementMailService,
    StaffInviteMailService,
    EmailRetryService,
    InstallmentMailService,
  ],
})
export class EmailModule {}
