import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

@Injectable()
export class AdminNotifyMailService {
  private adminEmail = 'dominionbanjo@gmail.com'; // Admin email based on EmailService sender

  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

  async notifyNewSignup(user: { name: string; email: string; role: string }) {
    const title = 'New User Signup 👤';
    const content = `
      <p style="color:#555;">A new user has just signed up on EasyStore:</p>
      <div style="background:#f4f4f4; padding:15px; border-radius:8px; margin:15px 0;">
        <p style="margin:5px 0;"><b>Name:</b> ${user.name}</p>
        <p style="margin:5px 0;"><b>Email:</b> ${user.email}</p>
        <p style="margin:5px 0;"><b>Initial Role:</b> ${user.role}</p>
      </div>
      <p style="color:#555;">Login to the admin dashboard to review the user profile.</p>
    `;

    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: this.adminEmail,
      subject: `New Signup: ${user.name}`,
      html,
    });
  }

  async notifyNewStoreCreated(store: {
    name: string;
    ownerName: string;
    email: string;
  }) {
    const title = 'New Store Created 🏪';
    const content = `
      <p style="color:#555;">A new vendor store has been created and is awaiting approval:</p>
      <div style="background:#f4f4f4; padding:15px; border-radius:8px; margin:15px 0;">
        <p style="margin:5px 0;"><b>Store Name:</b> ${store.name}</p>
        <p style="margin:5px 0;"><b>Owner:</b> ${store.ownerName}</p>
        <p style="margin:5px 0;"><b>Contact:</b> ${store.email}</p>
      </div>
      <p style="color:#555;">This store is currently set to <b>Pending</b>. Please review and approve it from the admin panel.</p>
    `;

    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: this.adminEmail,
      subject: `Awaiting Approval: ${store.name}`,
      html,
    });
  }

  async notifyStatusUpdate(
    user: { name: string; email: string },
    newStatus: string,
  ) {
    const title = 'Account Status Updated';
    const content = `
      <p style="color:#555;">Admin has updated the character status of <b>${user.name}</b> (${user.email}) to <b>${newStatus}</b>.</p>
    `;

    const html = this.tpl.wrapper(title, content);
    return this.email.sendEmail({
      to: this.adminEmail,
      subject: `Admin Action: Status Updated`,
      html,
    });
  }
}
