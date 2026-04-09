import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailTemplateService {
  private readonly brandColor = '#6366f1'; // Indigo-500
  private readonly secondaryColor = '#f97316'; // Orange-500
  private readonly textColor = '#1f2937'; // Gray-800
  private readonly mutedTextColor = '#6b7280'; // Gray-500
  private readonly bgColor = '#f3f4f6'; // Gray-100

  private getBaseStyles() {
    return `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: ${this.bgColor}; color: ${this.textColor}; -webkit-font-smoothing: antialiased; }
        .wrapper { width: 100%; table-layout: fixed; background-color: ${this.bgColor}; padding-bottom: 40px; }
        .main { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-spacing: 0; font-family: sans-serif; color: ${this.textColor}; border-radius: 12px; overflow: hidden; margin-top: 40px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
        .header { padding: 40px 0 20px; text-align: center; background: linear-gradient(135deg, ${this.brandColor} 0%, #4f46e5 100%); }
        .content { padding: 40px 30px; line-height: 1.6; }
        .footer { text-align: center; padding: 30px; font-size: 13px; color: ${this.mutedTextColor}; }
        .button { display: inline-block; padding: 14px 28px; background-color: ${this.brandColor}; color: #ffffff !important; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; border: none; }
        .divider { border-top: 1px solid #e5e7eb; margin: 30px 0; }
        h1, h2, h3 { color: #111827; margin-top: 0; font-weight: 700; }
        p { margin: 0 0 16px; }
        .logo-img { max-width: 150px; height: auto; display: block; margin: 0 auto; }
      </style>
    `;
  }

  wrapper(title: string, content: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${this.getBaseStyles()}
      </head>
      <body>
        <div class="wrapper">
          <table class="main">
            <tr>
              <td class="header">
                <img src="${process.env.FRONTEND_URL || 'https://eazystore.com.ng'}/logos/inline-stripe.png" alt="EasyStore" class="logo-img" style="filter: brightness(0) invert(1);" />
              </td>
            </tr>
            <tr>
              <td class="content">
                <h2 style="margin-bottom: 24px; color: #111827; text-align: center;">${title}</h2>
                <div style="font-size: 16px;">
                  ${content}
                </div>
                <div class="divider"></div>
                <p style="font-size: 14px; color: ${this.mutedTextColor}; text-align: center; margin-bottom: 0;">
                  If you have any questions, feel free to contact our support team at <a href="mailto:support@easystore.com" style="color: ${this.brandColor};">support@easystore.com</a>
                </p>
              </td>
            </tr>
            <tr>
              <td class="footer">
                <p style="margin-bottom: 10px;">&copy; ${new Date().getFullYear()} EasyStore Inc. All rights reserved.</p>
                <p>123 Commerce St, Digital Valley, ES 10101</p>
                <div style="margin-top: 20px;">
                  <a href="#" style="margin: 0 10px; color: ${this.mutedTextColor}; text-decoration: none;">Privacy Policy</a>
                  <a href="#" style="margin: 0 10px; color: ${this.mutedTextColor}; text-decoration: none;">Terms of Service</a>
                </div>
              </td>
            </tr>
          </table>
        </div>
      </body>
      </html>
    `;
  }

  wrapperWithLogo(title: string, content: string, logoUrl: string) {
    // Keep it similar but maybe allow custom logo for vendors if needed in future
    return this.wrapper(title, content);
  }

  button(text: string, url: string) {
    return `<a href="${url}" class="button">${text}</a>`;
  }
}
