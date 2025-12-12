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

    const body = `
      <p style="color:#555;">Hi <b>${name}</b>,</p>
      <p style="color:#555;">
        Thank you for signing up. Please use the OTP below to verify your email address.<br />
        It expires in <b>10 minutes</b>.
      </p>

      <div style="
        text-align:center;
        font-size:28px;
        font-weight:bold;
        color:#007bff;
        letter-spacing:6px;
        margin:25px 0;
      ">
        ${otp}
      </div>

      <p style="color:#777; text-align:center;">
        If you didn’t request this, please ignore this email.
      </p>
    `;

    const html = this.tpl.wrapperWithLogo(
      'Verify Your Email Address',
      body,
      'https://easystore01.netlify.app/logos/inline-stripe.png',
    );

    return this.email.sendEmail({
      to: email,
      subject: 'Verify Your EasyStore Account',
      html,
    });
  }
}
