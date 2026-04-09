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

    const title = 'Welcome to the Future of Commerce! 🌟';

    let content = `
      <p>Hi <b>${name}</b>,</p>
      <p>
        We're absolutely thrilled to have you join <b>EazyStore</b>! You've just taken the first step towards a smarter, 
        more seamless shopping and selling experience.
      </p>
      
      <div style="background-color: #f3f4f6; padding: 25px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0;">
        <h3 style="margin-top: 0; color: ${this.tpl.brandColor};">🚀 Getting Started</h3>
        <p style="font-size: 14px; margin-bottom: 20px;">Here are your first steps to making the most of EazyStore:</p>
        
        <table style="width: 100%; border-spacing: 0;">
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="font-weight: 700; color: ${this.tpl.brandColor}; margin-right: 10px;">1.</span> 
              Complete your profile settings
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
              <span style="font-weight: 700; color: ${this.tpl.brandColor}; margin-right: 10px;">2.</span> 
              ${role === 'vendor' ? 'Set up your custom storefront' : 'Explore trending products'}
            </td>
          </tr>
          <tr>
            <td style="padding: 10px 0;">
              <span style="font-weight: 700; color: ${this.tpl.brandColor}; margin-right: 10px;">3.</span> 
              ${role === 'vendor' ? 'Add your first product' : 'Save your favorite stores'}
            </td>
          </tr>
        </table>
      </div>
    `;

    if (role === 'vendor') {
      content += `
        <div style="border: 2px dashed ${this.tpl.brandColor}; padding: 20px; border-radius: ${this.tpl.borderRadius}; margin: 30px 0; text-align: center;">
          <h3 style="margin-top: 0;">Ready to Start Selling?</h3>
          <p style="font-size: 14px;">Your dashboard is ready and waiting. Start building your empire today!</p>
          ${this.tpl.button('Visit Vendor Dashboard', `${process.env.FRONTEND_URL}/vendor/dashboard`)}
        </div>
      `;
    } else {
      content += `
        <div style="text-align: center; margin: 30px 0;">
          ${this.tpl.button('Start Shopping Now', `${process.env.FRONTEND_URL}/explore`)}
        </div>
      `;
    }

    content += `
      <div style="margin: 30px 0; padding: 20px; border-radius: ${this.tpl.borderRadius}; border: 1px solid #e5e7eb;">
        <h4 style="margin-top: 0;">💡 Quick Tip</h4>
        <p style="font-size: 14px; color: #6b7280; margin-bottom: 0;">
          Access your account and settings anytime by clicking on your profile icon at the top right of the page.
        </p>
      </div>

      <p style="margin-top: 30px;">
        Happy ${role === 'vendor' ? 'selling' : 'shopping'}, <br/>
        <b>The EazyStore Team</b>
      </p>
    `;

    const html = this.tpl.wrapper(title, content);

    return this.email.sendEmail({
      to: email,
      subject: 'Welcome to EazyStore! 🎉',
      html,
    });
  }
}
