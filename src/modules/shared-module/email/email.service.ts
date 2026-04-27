import { Injectable } from '@nestjs/common';
import SibApiV3Sdk from 'sib-api-v3-sdk';

@Injectable()
export class EmailService {
  private client = SibApiV3Sdk.ApiClient.instance;

  constructor() {
    const apiKey = this.client.authentications['api-key'];
    apiKey.apiKey = process.env.BREVO_API_KEY!;
  }

  async sendEmail({
    to,
    subject,
    html,
    attachments,
  }: {
    to: string;
    subject: string;
    html: string;
    attachments?: { content: string; name: string }[];
  }) {
    try {
      const transactional = new SibApiV3Sdk.TransactionalEmailsApi();

      await transactional.sendTransacEmail({
        sender: {
          email: 'support@eazystore.com.ng',
          name: 'EazyStore',
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        attachment: attachments,
      });
    } catch (e: any) {
      const errorDetail = e.response?.body || e.response?.text || e.message;
      console.error('EMAIL ERROR → ', errorDetail);
      if (e.response?.body) console.error('BODY →', JSON.stringify(e.response.body, null, 2));
      throw new Error(`Email sending failed: ${e.message}`);
    }
  }
}
