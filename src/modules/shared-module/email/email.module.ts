import { Module } from '@nestjs/common';
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

@Module({
  providers: [
    EmailService,
    EmailTemplateService,

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
  ],
})
export class EmailModule {}
