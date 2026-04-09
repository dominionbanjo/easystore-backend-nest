import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

@Injectable()
export class AdminNotifyMailService {
  private readonly adminEmail = 'dominionbanjo@gmail.com';
  private readonly adminPanelUrl = `${process.env.FRONTEND_URL || 'https://eazystore.com.ng'}/admin`;

  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

  async notifyNewSignup(user: { name: string; email: string; role: string }) {
    const title = 'New User Registration 👤';
    const content = `
      <p>System notification: A new user has joined the EasyStore platform.</p>
      
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 25px; border-radius: 12px; margin: 30px 0;">
        <h3 style="margin-top: 0; color: #1e293b; font-size: 16px;">User Details</h3>
        <table style="width: 100%; border-spacing: 0;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px; width: 100px;">Name</td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${user.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Email</td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px;">${user.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 14px;">Role</td>
            <td style="padding: 8px 0; color: #1e293b; font-weight: 600; font-size: 14px; text-transform: capitalize;">${user.role}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Review User Profile', `${this.adminPanelUrl}/users`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: this.adminEmail,
      subject: `[Admin] New Signup: ${user.name}`,
      html,
    });
  }

  async notifyNewStoreCreated(store: {
    name: string;
    ownerName: string;
    email: string;
  }) {
    const title = 'New Store Awaiting Approval 🏪';
    const content = `
      <p>System Alert: A new vendor store has been created and requires administrative review for activation.</p>
      
      <div style="background-color: #fffbeb; border: 1px solid #fef3c7; padding: 25px; border-radius: 12px; margin: 30px 0;">
        <h3 style="margin-top: 0; color: #92400e; font-size: 16px;">Store Information</h3>
        <table style="width: 100%; border-spacing: 0;">
          <tr>
            <td style="padding: 8px 0; color: #b45309; font-size: 14px; width: 110px;">Store Name</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 700; font-size: 14px;">${store.name}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #b45309; font-size: 14px;">Owner</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 14px;">${store.ownerName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #b45309; font-size: 14px;">Contact</td>
            <td style="padding: 8px 0; color: #111827; font-weight: 600; font-size: 14px;">${store.email}</td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin-top: 30px;">
        ${this.tpl.button('Review and Approve Store', `${this.adminPanelUrl}/stores`)}
      </div>
    `;

    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: this.adminEmail,
      subject: `[Action Required] New Store: ${store.name}`,
      html,
    });
  }

  async notifyStatusUpdate(
    user: { name: string; email: string },
    newStatus: string,
  ) {
    const title = 'System Log: Status Change';
    const content = `
      <p>Administrative Log: The status for <b>${user.name}</b> (${user.email}) has been updated to <span style="font-weight: 700; color: #6366f1;">${newStatus.toUpperCase()}</span>.</p>
    `;

    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: this.adminEmail,
      subject: `[Log] Status Updated: ${user.name}`,
      html,
    });
  }
}
