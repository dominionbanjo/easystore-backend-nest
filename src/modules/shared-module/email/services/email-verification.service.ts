import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

interface EmailVerificationPayload {
  name: string;
  email: string;
  otp: string;
}

@Injectable()
export class EmailVerificationService {
  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

  async sendVerificationEmail(payload: EmailVerificationPayload) {
    const { name, email, otp } = payload;

    const title = 'Verify Your Email Address';

    const content = `
      <p>Hi <b>${name}</b>,</p>
      <p>
        Thank you for joining EasyStore! To complete your registration and secure your account, please use the verification code below.
      </p>

      <div style="background-color: #f3f4f6; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
        <p style="font-size: 14px; color: #6b7280; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
        <div style="font-size: 42px; font-weight: 800; color: #6366f1; letter-spacing: 10px; margin: 0;">
          ${otp}
        </div>
        <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">This code will expire in <b>10 minutes</b>.</p>
      </div>

      <p style="font-size: 14px; color: #6b7280; text-align: center;">
        If you didn't create an account with EasyStore, you can safely ignore this email.
      </p>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: `Verify your account: ${otp}`,
      html,
    });
  }
}
