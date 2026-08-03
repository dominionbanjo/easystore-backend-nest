import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

@Injectable()
export class StaffInviteMailService {
  constructor(
    private readonly email: EmailService,
    private readonly tpl: EmailTemplateService,
  ) {}

  async sendInviteEmail(payload: {
    email: string;
    name: string;
    storeName: string;
    tempPassword: string;
  }) {
    const { email, name, storeName, tempPassword } = payload;
    const html = this.tpl.wrapper(
      "You've been invited!",
      `
      <h2>Welcome to ${storeName}!</h2>
      <p>Hi ${name},</p>
      <p>You have been invited to join <strong>${storeName}</strong> as a staff member.</p>
      <p>Here are your login credentials:</p>
      <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:#666;">Your temporary password:</p>
        <code style="font-size:18px;font-weight:bold;color:#17c06e;background:#fff;padding:8px 16px;border-radius:4px;">${tempPassword}</code>
      </div>
      <p style="color:#e74c3c;font-size:13px;"><strong>⚠ Security notice:</strong> You will be prompted to change this password on your first login.</p>
      <p>Click the button below to log in and get started:</p>
      <a href="${process.env.FRONTEND_URL || 'https://eazystore.com.ng'}/auth/login" style="display:inline-block;background:#17c06e;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;margin:8px 0;">Log In to Dashboard</a>
      `,
    );
    return this.email.sendEmail({
      to: email,
      subject: `You've been invited to join ${storeName}`,
      html,
    });
  }

  async sendPasswordResetEmail(payload: {
    email: string;
    name: string;
    tempPassword: string;
  }) {
    const { email, name, tempPassword } = payload;
    const html = this.tpl.wrapper(
      'Password Reset',
      `
      <h2>Password Reset</h2>
      <p>Hi ${name},</p>
      <p>Your store administrator has reset your password.</p>
      <div style="background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;text-align:center;">
        <p style="margin:0 0 8px;font-size:14px;color:#666;">Your new temporary password:</p>
        <code style="font-size:18px;font-weight:bold;color:#17c06e;background:#fff;padding:8px 16px;border-radius:4px;">${tempPassword}</code>
      </div>
      <p style="color:#e74c3c;font-size:13px;"><strong>⚠ Security notice:</strong> You will be prompted to change this password on your first login after reset.</p>
      <a href="${process.env.FRONTEND_URL || 'https://eazystore.com.ng'}/auth/login" style="display:inline-block;background:#17c06e;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;margin:8px 0;">Log In</a>
      `,
    );
    return this.email.sendEmail({
      to: email,
      subject: 'Your password has been reset',
      html,
    });
  }
}
