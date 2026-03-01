import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

interface WelcomeEmailPayload {
  name: string;
  email: string;
  role: 'user' | 'vendor' | 'admin';
}

@Injectable()
export class WelcomeMailService {
  constructor(
    private email: EmailService,
    private tpl: EmailTemplateService,
  ) {}

  async sendWelcomeEmail(payload: WelcomeEmailPayload) {
    const { name, email, role } = payload;

    const logoUrl = 'https://easystore01.netlify.app/logos/inline-stripe.png';
    const title = 'Welcome to EasyStore! 🎉';

    let content = `
      <p style="color:#555; line-height:1.6;">Hi <b>${name}</b>,</p>
      <p style="color:#555; line-height:1.6;">
        Welcome to <b>EasyStore</b>! We're excited to have you join our community. 
        EasyStore is your all-in-one platform for seamless commerce and effortless shopping.
      </p>
    `;

    if (role === 'vendor') {
      content += `
        <div style="background:#f9f9f9; padding:15px; border-radius:8px; margin:20px 0; border-left:4px solid #10b981;">
          <h3 style="margin-top:0; color:#10b981;">Unlock Your Selling Potential 🚀</h3>
          <p style="color:#555; font-size:14px; margin-bottom:0;">
            As a vendor, you can now:
            <ul style="padding-left:20px; color:#555; font-size:14px;">
              <li>Create your own custom storefront in seconds.</li>
              <li>Manage products, inventory, and orders with ease.</li>
              <li>Track your revenue with real-time analytics.</li>
              <li>Connect with customers directly through localized sales channels.</li>
            </ul>
          </p>
        </div>
      `;
    }

    content += `
      <div style="margin:25px 0; padding:15px; background: #f0f7ff; border-radius:8px; border: 1px solid #cce3ff;">
        <h4 style="margin-top:0; color:#0066cc;">💡 Pro-Tip: Navigating Your Account</h4>
        <p style="color:#555; font-size:14px; margin-bottom:0;">
          <b>On Mobile:</b> Click the <b>hamburger menu (three lines)</b> at the top corner to access all your sections and settings. <br/>
          <b>On Desktop:</b> Click your <b>profile icon</b> at the top right to manage your account, view orders, and more.
        </p>
      </div>

      <p style="color:#555; line-height:1.6;">
        We're here to help you get the most out of EasyStore. If you have any questions, simply reply to this email or visit our help center.
      </p>

      <p style="color:#555; margin-top:30px;">
        Happy ${role === 'vendor' ? 'selling' : 'shopping'}, <br/>
        <b>The EasyStore Team</b>
      </p>
    `;

    const html = this.tpl.wrapperWithLogo(title, content, logoUrl);

    return this.email.sendEmail({
      to: email,
      subject: 'Welcome to EasyStore!',
      html,
    });
  }
}
