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

    switch (newStatus) {
      case 'active':
        title = 'Account Activated! 🎉';
        content = `
          <p>Hi <b>${user.name}</b>,</p>
          <p>Great news! Your EasyStore account status has been updated to <b>Active</b>.</p>
          <p>You now have full access to all platform features. You can log in and continue your commerce journey.</p>
          <div style="text-align: center; margin-top: 30px;">
            ${this.tpl.button('Login to My Account', `${process.env.FRONTEND_URL}/auth/login`)}
          </div>
        `;
        break;
      case 'restricted':
        title = 'Account Restricted ⚠️';
        content = `
          <p>Hi <b>${user.name}</b>,</p>
          <p>Please be informed that your EasyStore account has been <b>Restricted</b> by our team for a review.</p>
          <p>While restricted, some features may be limited. If you believe this is a mistake or need clarification, please contact our support team to resolve this.</p>
          <div style="text-align: center; margin-top: 30px;">
            ${this.tpl.button('Contact Support', 'mailto:support@easystore.com')}
          </div>
        `;
        break;
      case 'banned':
        title = 'Account Suspended 🚫';
        content = `
          <p>Hi <b>${user.name}</b>,</p>
          <p>Your EasyStore account has been <b>Suspended</b> due to a violation of our terms of service.</p>
          <p>You will no longer be able to log in or access your store. If you wish to appeal this decision, please reach out to our administrative team.</p>
        `;
        break;
      default:
        return;
    }

    const html = this.tpl.wrapper(title, content);
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
    const content = `
      <p>Hi <b>${vendor.name}</b>,</p>
      <p>Excellent news! Your store, <b>${vendor.storeName}</b>, has been reviewed and <b>Approved</b> by our team.</p>
      <p>Your storefront is now visible to customers, and you can start listing products and accepting orders immediately.</p>
      
      <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; padding: 25px; border-radius: 12px; margin: 30px 0;">
        <h3 style="margin-top: 0; color: #166534;">🚀 Next Steps</h3>
        <ul style="padding-left: 20px; font-size: 14px; color: #166534;">
          <li style="margin-bottom: 8px;">Upload high-quality product images to stand out.</li>
          <li style="margin-bottom: 8px;">Share your store link on social media to drive traffic.</li>
          <li style="margin-bottom: 8px;">Set up your customized delivery rates.</li>
          <li>Configure your payout settings to get paid.</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Go to Store Dashboard', `${process.env.FRONTEND_URL}/vendor/dashboard`)}
      </div>

      <p style="margin-top: 30px;">
        Happy Selling! <br/>
        <b>The EasyStore Team</b>
      </p>
    `;

    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: vendor.email,
      subject: `Store Approved: ${vendor.storeName}`,
      html,
    });
  }
}
