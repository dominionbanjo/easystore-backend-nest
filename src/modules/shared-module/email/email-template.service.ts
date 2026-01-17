import { Injectable } from '@nestjs/common';

@Injectable()
export class EmailTemplateService {
  wrapper(title: string, content: string): string {
    return `
      <div style="font-family: Arial; max-width:600px; margin:auto; padding:20px; border:1px solid #eee; border-radius:10px;">
        <h2 style="text-align:center; color:#333;">${title}</h2>

        <div style="margin-top:20px; color:#444;">
          ${content}
        </div>

        <p style="font-size:12px; color:#999; text-align:center; margin-top:30px;">
          © ${new Date().getFullYear()} EasyStore. All rights reserved.
        </p>
      </div>
    `;
  }

  wrapperWithLogo(title: string, content: string, logoUrl: string) {
    return `
    <div style="font-family:Arial; max-width:600px; margin:auto; background:#fff; border:1px solid #eee; border-radius:10px; padding:20px;">
      <div style="text-align:center; margin-bottom:20px;">
        <img src="${logoUrl}" alt="Logo" width="120" />
      </div>

      <h2 style="text-align:center; color:#333;">${title}</h2>

      <div style="margin-top:20px; color:#444;">
        ${content}
      </div>

      <p style="font-size:12px; color:#999; text-align:center; margin-top:30px;">
        © ${new Date().getFullYear()} EasyStore. All rights reserved.
      </p>
    </div>
  `;
  }
}
