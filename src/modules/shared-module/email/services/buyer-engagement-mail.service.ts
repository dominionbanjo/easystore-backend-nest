import { Injectable } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailTemplateService } from '../email-template.service';

@Injectable()
export class BuyerEngagementMailService {
  constructor(
    private readonly email: EmailService,
    private readonly tpl: EmailTemplateService,
  ) {}

  /**
   * 🚀 Send a high-impact engagement email to re-activate buyers
   */
  async sendDiscoveryEmail(to: string, firstName: string) {
    const html = this.tpl.wrapper(
      'Find Your Next Favorite Item!',
      `
        <div style="text-align: center; margin-bottom: 30px;">
          <p style="font-size: 18px; color: #374151;">Hi <b>${firstName}</b>,</p>
          <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
            The marketplace is buzzing with new high-quality products from our top-rated vendors. 
            From artisan crafts to daily essentials, there's always something new to discover.
          </p>
        </div>

        <div style="background: linear-gradient(to right, #fef3c7, #fefce8); padding: 25px; border-radius: ${this.tpl.borderRadius}; border: 1px solid #fde68a; margin-bottom: 30px; text-align: center;">
             <h3 style="margin-top: 0; color: #92400e;">✨ Curated Just for You</h3>
             <p style="font-size: 14px; color: #b45309; margin-bottom: 0;">
                Our algorithm has hand-picked a selection of stores that match your interests. 
                Don't let these unique finds slip away!
             </p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          ${this.tpl.button('Start Exploring', `${process.env.FRONTEND_URL || 'https://eazystore.com.ng'}`)}
        </div>

        <div style="margin-top: 40px; padding: 20px; border-top: 1px dashed #e5e7eb; text-align: center;">
          <p style="font-size: 12px; color: #9ca3af; text-transform: uppercase; tracking-wider: 0.1em; font-weight: 700;">
            Why shop on EasyStore?
          </p>
          <div style="display: table; width: 100%; margin-top: 15px;">
            <div style="display: table-cell; width: 33.33%; padding: 0 10px;">
                <p style="font-size: 12px; font-weight: 600; color: #4b5563;">Verified Vendors</p>
            </div>
            <div style="display: table-cell; width: 33.33%; padding: 0 10px;">
                <p style="font-size: 12px; font-weight: 600; color: #4b5563;">Secure Escrow</p>
            </div>
            <div style="display: table-cell; width: 33.33%; padding: 0 10px;">
                <p style="font-size: 12px; font-weight: 600; color: #4b5563;">Fast Delivery</p>
            </div>
          </div>
        </div>
      `,
    );

    return this.email.sendEmail({
      to,
      subject: 'Something special is waiting for you on EasyStore! 🚀',
      html,
    });
  }

  /**
   * 📈 Trending products notification
   */
  async sendTrendingPrompt(to: string, firstName: string) {
    const html = this.tpl.wrapper(
        'Trending This Week 🔥',
        `
          <p>Hi <b>${firstName}</b>,</p>
          <p>Don't be the last to know! These products are flying off the shelves this week.</p>
          <p>Join thousands of other shoppers and find amazing deals directly from the source.</p>
          
          <div style="text-align: center; margin-top: 30px;">
            ${this.tpl.button('View Trending Items', `${process.env.FRONTEND_URL || 'https://eazystore.com.ng'}/discovery`)}
          </div>
        `,
      );
  
      return this.email.sendEmail({
        to,
        subject: 'People are loving these! Check them out now',
        html,
      });
  }
}
