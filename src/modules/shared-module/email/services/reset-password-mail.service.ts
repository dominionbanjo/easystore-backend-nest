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
    const title = 'Reset Your Password';

    const content = `
      <p>Hello <b>${name}</b>,</p>
      <p>
        We received a request to reset your EasyStore password. No changes have been made to your account yet.
      </p>
      
      <p>Click the button below to set a new password. For your security, this link will expire in <b>10 minutes</b>.</p>

      <div style="text-align: center; margin: 30px 0;">
        ${this.tpl.button('Reset My Password', resetURL)}
      </div>

      <div style="background-color: #fffbeb; border-radius: ${this.tpl.borderRadius}; padding: 20px; border: 1px solid #fef3c7; margin-top: 30px;">
        <p style="font-size: 14px; color: #92400e; margin-bottom: 0;">
          <b>Security Tip:</b> If you did not request a password reset, please ignore this email or contact support if you're concerned about your account security.
        </p>
      </div>

      <div class="divider"></div>

      <p style="font-size: 13px; color: #9ca3af;">
        If the button above doesn't work, copy and paste this link into your browser: <br/>
        <a href="${resetURL}" style="color: ${this.tpl.brandColor}; word-break: break-all;">${resetURL}</a>
      </p>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: 'Reset your EasyStore password',
      html,
    });
  }
}
