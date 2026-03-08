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
    const title = 'Welcome to the Vendor Family! 🏪';
    const logoUrl = 'https://easystore01.netlify.app/logos/inline-stripe.png';
    const setupGuideUrl = 'https://example.com/vendor-setup-guide'; // Replace with actual guide URL
    const videoUrl = 'https://www.youtube.com/watch?v=k_XUaKOn68Y'; // Placeholder video link

    const content = `
      <p style="color:#555;">Hi <b>${vendor.name}</b>,</p>
      <p style="color:#555;">Congratulations on creating your store, <b>${vendor.storeName}</b>! We're thrilled to have you as part of our growing commerce community.</p>
      
      <div style="background:#fff7ed; padding:15px; border-radius:8px; margin:20px 0; border:1px solid #ffedd5;">
        <h4 style="color:#c2410c; margin-top:0;">📋 Next Step: Admin Review</h4>
        <p style="color:#555; font-size:14px; margin-bottom:0;">
          To ensure platform quality, all new stores undergo a quick review by our team. 
          Your store is currently <b>pending approval</b> and will be live shortly. 
          We'll notify you as soon as it's active!
        </p>
      </div>

      <div style="margin:25px 0;">
        <h4 style="color:#333;">🚀 Get Started While You Wait</h4>
        <p style="color:#555; font-size:14px;">
          While your store is being reviewed, you can start preparing your product catalog and store settings. 
          Watch our <b>Quick Setup Guide</b> to learn how to make the most of your storefront:
        </p>
        
        <div style="text-align:center; margin:20px 0;">
          <a href="${videoUrl}" style="background:#ef4444; color:white; padding:12px 25px; border-radius:6px; text-decoration:none; font-weight:bold; display:inline-block;">
            📺 Watch Setup Video
          </a>
        </div>
        
        <p style="color:#555; font-size:14px; text-align:center;">
          Or read the <a href="${setupGuideUrl}" style="color:#3b82f6; text-decoration:underline;">Full Documentation</a> here.
        </p>
      </div>

      <p style="color:#555; line-height:1.6;">
        If you need any assistance setting up, simply reply to this email. We can't wait to see your store live!
      </p>

      <p style="color:#555; margin-top:30px;">
        Best regards, <br/>
        <b>The EasyStore Vendor Team</b>
      </p>
    `;

    const html = this.tpl.wrapperWithLogo(title, content, logoUrl);
    return this.email.sendEmail({
      to: vendor.email,
      subject: `Store Created: ${vendor.storeName} is pending approval`,
      html,
    });
  }
}
