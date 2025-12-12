import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

interface ResetPasswordPayload {
  name: string;
  email: string;
  token: string;
  origin: string;
}

@Injectable()
export class ResetPasswordMailService {
  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

  async sendResetPasswordEmail(payload: ResetPasswordPayload) {
    const { name, email, token, origin } = payload;

    const resetURL = `${origin}/auth/reset-password?token=${token}&email=${email}`;

    const content = `
      <p style="font-size:16px; font-weight:600; color:#111827;">
        Hello, ${name}
      </p>

      <p style="font-size:15px; color:#374151; line-height:1.6;">
        We received a request to reset your password. Click the button below to securely reset it.
        If you didn’t request this, you can safely ignore this email.
      </p>

      <div style="text-align:center; margin:24px 0;">
        <a href="${resetURL}" style="
          background-color:#1f2937;
          color:#ffffff;
          text-decoration:none;
          font-weight:600;
          padding:14px 32px;
          border-radius:8px;
          display:inline-block;
        ">Reset Password</a>
      </div>

      <p style="font-size:14px; color:#6b7280; line-height:1.6; margin-top:12px;">
        This link will expire in 10 minutes for your security.<br/>
        If the button above doesn’t work, copy and paste the link below:
      </p>

      <p style="word-break:break-all; margin-top:8px;">
        <a href="${resetURL}" style="color:#2563eb; font-size:13px;">
          ${resetURL}
        </a>
      </p>
    `;

    const html = this.tpl.wrapperWithLogo(
      'Reset Your Password',
      content,
      'https://yourwebsite.com/logo.png', // replace with real EasyStore logo
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Reset your easyStore password',
      html,
    });
  }
}
