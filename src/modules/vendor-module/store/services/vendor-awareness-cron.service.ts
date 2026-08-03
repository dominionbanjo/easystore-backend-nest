import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Store } from '../entities/store.entity';
import { VendorAwarenessMailService } from 'src/modules/shared-module/email/services/vendor-awareness-mail.service';

@Injectable()
export class VendorAwarenessCronService {
  private readonly logger = new Logger(VendorAwarenessCronService.name);

  constructor(
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly vendorMailService: VendorAwarenessMailService,
  ) {}

  @Cron('0 9 * * *') // Runs every day at 9:00 AM
  async handleVendorAwareness() {
    this.logger.log('Starting Vendor Awareness Cron Job...');

    // Fetch all active or pending stores with their users
    const stores = await this.storeRepo.find({
      where: [{ status: 'active' }, { status: 'pending' }],
      relations: ['user', 'theme_setting'],
    });

    const now = new Date();
    // 2 Days threshold
    const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

    for (const store of stores) {
      if (!store.user?.email) continue;

      const lastSent = store.last_awareness_email_sent;
      const timeSinceLastEmail = lastSent
        ? now.getTime() - lastSent.getTime()
        : null;

      // Only send if no email has been sent yet, or it has been at least 2 days since the last awareness email
      if (
        lastSent &&
        timeSinceLastEmail !== null &&
        timeSinceLastEmail < TWO_DAYS_MS
      ) {
        continue;
      }

      let emailSent = false;

      // Priority 1: No products at all (Onboarding)
      if (store.total_products === 0) {
        if (!store.last_awareness_email_sent) {
          // Send Welcome Setup Reminder
          await this.vendorMailService.sendWelcomeSetupReminder(
            store.user.email,
            store.store_name,
          );
        } else {
          // Follow-up
          await this.vendorMailService.sendFirstProductPrompt(
            store.user.email,
            store.store_name,
          );
        }
        emailSent = true;
      }
      // Priority 2: Missing bank details
      else if (!store.payout_verified && !store.bank_code) {
        await this.vendorMailService.sendBankSetupReminder(
          store.user.email,
          store.store_name,
        );
        emailSent = true;
      }
      // Priority 3: Low Catalog (< 5 products)
      else if (store.total_products > 0 && store.total_products < 5) {
        await this.vendorMailService.sendCatalogGrowthPrompt(
          store.user.email,
          store.store_name,
        );
        emailSent = true;
      }
      // Priority 4: No theme customized
      else if (
        !store.theme_setting ||
        !store.theme_setting.custom_config ||
        store.theme_setting.custom_config.primary_color === 'hsla(0, 0%, 9%, 1)'
      ) {
        await this.vendorMailService.sendThemeCustomizationPrompt(
          store.user.email,
          store.store_name,
        );
        emailSent = true;
      }
      // Priority 5: Growth - Social Sharing Features
      else if (store.total_products >= 5 && !lastSent) {
        // Placeholder logic to trigger once for active sellers
        await this.vendorMailService.sendSocialSharePrompt(
          store.user.email,
          store.store_name,
        );
        emailSent = true;
      }
      // Priority 6: Maintenance & Advanced Features (Offline Sales / Performance)
      else {
        // Here we alternate based on presence of sales
        if (store.total_revenue > 0) {
          // If they have revenue, alternate between performance summary and social sharing growth
          const rand = Math.random();
          if (rand > 0.5) {
            const weeklyOrders =
              Math.floor(Math.random() * 5) + store.total_orders;
            await this.vendorMailService.sendWeeklyPerformanceSummary(
              store.user.email,
              store.store_name,
              weeklyOrders,
            );
          } else {
            await this.vendorMailService.sendSocialSharePrompt(
              store.user.email,
              store.store_name,
            );
          }
        } else {
          // If no revenue, alternate between offline sales and setup refinement
          const rand = Math.random();
          if (rand > 0.5) {
            await this.vendorMailService.sendOfflineSalesFeaturePrompt(
              store.user.email,
              store.store_name,
            );
          } else {
            await this.vendorMailService.sendThemeCustomizationPrompt(
              store.user.email,
              store.store_name,
            );
          }
        }
        emailSent = true;
      }

      if (emailSent) {
        await this.storeRepo.update(store.id, {
          last_awareness_email_sent: now,
        });
      }
    }

    this.logger.log('Vendor Awareness Cron Job completed.');
  }
}
