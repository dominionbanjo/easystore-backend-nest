import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

@Injectable()
export class AccountStatusMailService {
  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

  async sendStatusUpdateEmail(
    user: { name: string; email: string },
    newStatus: string,
  ) {
    let title = '';
    let content = '';
    const logoUrl = 'https://easystore01.netlify.app/logos/inline-stripe.png';

    switch (newStatus) {
      case 'active':
        title = 'Account Activated! 🎉';
        content = `
          <p style="color:#555;">Hi <b>${user.name}</b>,</p>
          <p style="color:#555;">Great news! Your EasyStore account status has been updated to <b>Active</b>.</p>
          <p style="color:#555;">You now have full access to all platform features. You can log in and continue where you left off.</p>
        `;
        break;
      case 'restricted':
        title = 'Account Restricted ⚠️';
        content = `
          <p style="color:#555;">Hi <b>${user.name}</b>,</p>
          <p style="color:#555;">Please be informed that your EasyStore account has been <b>Restricted</b> by the administration.</p>
          <p style="color:#555;">While restricted, some features may be limited. If you believe this is a mistake, please contact our support team to resolve this.</p>
        `;
        break;
      case 'banned':
        title = 'Account Suspended 🚫';
        content = `
          <p style="color:#555;">Hi <b>${user.name}</b>,</p>
          <p style="color:#555;">Your EasyStore account has been <b>Suspended</b> due to a violation of our terms of service.</p>
          <p style="color:#555;">You will no longer be able to log in or access your store. Please contact support if you wish to appeal this decision.</p>
        `;
        break;
      default:
        return;
    }

    content += `
      <div style="margin-top:30px; padding-top:20px; border-top:1px solid #eee;">
        <p style="color:#777; font-size:13px;">If you have any questions, feel free to reply to this email.</p>
      </div>
    `;

    const html = this.tpl.wrapperWithLogo(title, content, logoUrl);
    return this.email.sendEmail({
      to: user.email,
      subject: `Account Update: ${title}`,
      html,
    });
  }

  async sendStoreApprovalEmail(vendor: {
    name: string;
    email: string;
    storeName: string;
  }) {
    const title = 'Your Store is Live! 🏪 🎉';
    const logoUrl = 'https://easystore01.netlify.app/logos/inline-stripe.png';
    const content = `
      <p style="color:#555;">Hi <b>${vendor.name}</b>,</p>
      <p style="color:#555;">Excellent news! Your store, <b>${vendor.storeName}</b>, has been reviewed and <b>Approved</b> by our team.</p>
      <p style="color:#555;">Your storefront is now visible to customers, and you can start listing products and accepting orders.</p>
      <div style="background:#f0f9ff; padding:15px; border-radius:8px; margin:20px 0; border:1px solid #bae6fd;">
        <p style="color:#0369a1; font-weight:bold; margin-top:0;">What's Next?</p>
        <ul style="color:#555; font-size:14px; margin-bottom:0;">
          <li>Add more products to your catalog.</li>
          <li>Share your store link with your community.</li>
          <li>Set up your delivery rates for easier checkout.</li>
        </ul>
      </div>
      <p style="color:#555;">Happy Selling!</p>
    `;

    const html = this.tpl.wrapperWithLogo(title, content, logoUrl);
    return this.email.sendEmail({
      to: vendor.email,
      subject: `Store Approved: ${vendor.storeName}`,
      html,
    });
  }
}
