import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

@Injectable()
export class StoreWelcomeMailService {
  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

  async sendStoreWelcomeEmail(vendor: {
    name: string;
    email: string;
    storeName: string;
  }) {
    const title = 'Your Store Has Been Created! 🏪';
    const videoUrl = 'https://www.youtube.com/watch?v=k_XUaKOn68Y'; // Placeholder video link

    const content = `
      <p>Hi <b>${vendor.name}</b>,</p>
      <p>Congratulations! Your store, <b>${vendor.storeName}</b>, has been successfully created. We're excited to see your business grow on EazyStore.</p>
      
      <div style="background-color: #fff7ed; padding: 25px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0; border: 1px solid #ffedd5;">
        <h3 style="margin-top: 0; color: #c2410c;">📋 Next Step: Admin Review</h3>
        <p style="font-size: 14px; margin-bottom: 0; color: #9a3412;">
          To maintain the highest quality for our customers, all new stores undergo a quick review. 
          Your store is currently <b>pending approval</b> and will be live shortly. 
          We'll notify you as soon as you're ready to go!
        </p>
      </div>

      <h3 style="margin-top: 30px;">🚀 Get Started While You Wait</h3>
      <p style="font-size: 14px;">
        While we review your store, you can start preparing your product catalog and store settings. 
        Watch our <b>Quick Setup Guide</b> to hit the ground running:
      </p>
      
      <div style="text-align: center; margin: 30px 0;">
        ${this.tpl.button('📺 Watch Setup Video', videoUrl)}
      </div>

      <div style="background-color: #f3f4f6; padding: 20px; border-radius: ${this.tpl.borderRadius}; margin-top: 30px;">
        <h4 style="margin-top: 0;">Quick Checklist:</h4>
        <ul style="padding-left: 20px; font-size: 14px; color: #4b5563;">
          <li style="margin-bottom: 8px;">Upload high-quality product images</li>
          <li style="margin-bottom: 8px;">Set up your shipping rates</li>
          <li style="margin-bottom: 8px;">Connect your payout account</li>
          <li>Review store policies</li>
        </ul>
      </div>

      <p style="margin-top: 30px;">
        Best regards, <br/>
        <b>The EazyStore Vendor Team</b>
      </p>
    `;

    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: vendor.email,
      subject: `Store Created: ${vendor.storeName} is pending approval`,
      html,
    });
  }
}
