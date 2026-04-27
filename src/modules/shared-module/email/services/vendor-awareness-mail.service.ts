import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

@Injectable()
export class VendorAwarenessMailService {
  constructor(
    private readonly email: EmailService,
    private readonly tpl: EmailTemplateService,
  ) {}

  async sendWelcomeSetupReminder(email: string, storeName: string) {
    const html = this.tpl.wrapper(
      'Complete Your EasyStore Setup',
      `
        <p>Hi <b>${storeName}</b>,</p>
        <p>Welcome to EasyStore! We noticed you haven't completed your store setup yet. A fully configured store builds trust with your customers.</p>
        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Complete Setup', `${process.env.FRONTEND_URL}/vendor`)}
        </div>
      `,
    );
    return this.email.sendEmail({ to: email, subject: 'Take the next step with your storefront!', html });
  }

  async sendFirstProductPrompt(email: string, storeName: string) {
    const html = this.tpl.wrapper(
      'Add Your First Product!',
      `
        <p>Hi <b>${storeName}</b>,</p>
        <p>Your store is looking a little empty. Did you know stores with at least one product get 10x more profile visits?</p>
        <p>Add your first product today and start selling!</p>
        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Add Product', `${process.env.FRONTEND_URL}/vendor/products/new`)}
        </div>
      `,
    );
    return this.email.sendEmail({ to: email, subject: 'Your storefront is ready. Time to add products!', html });
  }

  async sendCatalogGrowthPrompt(email: string, storeName: string) {
    const html = this.tpl.wrapper(
      'Grow Your Catalog',
      `
        <p>Hi <b>${storeName}</b>,</p>
        <p>You're off to a great start! However, customers love variety. Expanding your product catalog to at least 5 items can dramatically increase your sales conversions.</p>
        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Add More Products', `${process.env.FRONTEND_URL}/vendor/products`)}
        </div>
      `,
    );
    return this.email.sendEmail({ to: email, subject: 'Offer more choices to your customers!', html });
  }

  async sendThemeCustomizationPrompt(email: string, storeName: string) {
    const html = this.tpl.wrapper(
      'Make Your Store Stand Out',
      `
        <p>Hi <b>${storeName}</b>,</p>
        <p>Your brand is unique, and your storefront should be too!</p>
        <p>Head to the setup module to customize your store's colors, radius, and themes to give your customers a premium experience.</p>
        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Customize Store', `${process.env.FRONTEND_URL}/vendor`)}
        </div>
      `,
    );
    return this.email.sendEmail({ to: email, subject: 'Make your EasyStore uniquely yours', html });
  }

  async sendOfflineSalesFeaturePrompt(email: string, storeName: string) {
    const html = this.tpl.wrapper(
      'New Feature: Record Offline Sales',
      `
        <p>Hi <b>${storeName}</b>,</p>
        <p>Did you know you can use EasyStore to manage your entire business, even for customers not buying online?</p>
        <p>Our new <b>Record Sale</b> feature lets you deduct inventory and calculate analytics for your offline and physical sales perfectly separating your online and offline revenue streams.</p>
        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Try Record Sale', `${process.env.FRONTEND_URL}/vendor/orders`)}
        </div>
      `,
    );
    return this.email.sendEmail({ to: email, subject: 'Manage physical sales directly from your dashboard', html });
  }

  async sendSocialSharePrompt(email: string, storeName: string) {
    const html = this.tpl.wrapper(
      'Share Your Products to the World',
      `
        <p>Hi <b>${storeName}</b>,</p>
        <p>Marketing just got easier! You and your customers can now instantly generate beautiful, branded images of your products to share on social media.</p>
        <p>Check out your product pages to try out the new Share button!</p>
        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('View My Products', `${process.env.FRONTEND_URL}/vendor/products`)}
        </div>
      `,
    );
    return this.email.sendEmail({ to: email, subject: 'Easily share your products on social media', html });
  }

  async sendBankSetupReminder(email: string, storeName: string) {
    const html = this.tpl.wrapper(
      'Get Paid Faster!',
      `
        <p>Hi <b>${storeName}</b>,</p>
        <p>We see you have sales, but haven't fully verified your payout bank account information!</p>
        <p>Please update your bank details so we can process your payouts seamlessly.</p>
        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Update Payout Info', `${process.env.FRONTEND_URL}/vendor`)}
        </div>
      `,
    );
    return this.email.sendEmail({ to: email, subject: 'Action Required: Add your bank details', html });
  }

  async sendWeeklyPerformanceSummary(email: string, storeName: string, weeklyOrders: number) {
    const html = this.tpl.wrapper(
      'Your Weekly Dashboard Summary',
      `
        <p>Hi <b>${storeName}</b>,</p>
        <p>It's been a busy week! You recorded <b>${weeklyOrders} orders</b> across your EasyStore platform.</p>
        <p>Log in to your dashboard to view your conversion rates, top customers, and analytics breakdown.</p>
        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('View Analytics Summary', `${process.env.FRONTEND_URL}/vendor/analytics`)}
        </div>
      `,
    );
    return this.email.sendEmail({ to: email, subject: 'Your weekly performance report is ready', html });
  }
}
