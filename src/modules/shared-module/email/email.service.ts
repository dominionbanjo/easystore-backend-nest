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
  }: {
    to: string;
    subject: string;
    html: string;
  }) {
    try {
      const transactional = new SibApiV3Sdk.TransactionalEmailsApi();

      await transactional.sendTransacEmail({
        sender: {
          email: 'dominionbanjo@gmail.com',
          name: 'easyStore',
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
      });
    } catch (e: any) {
      console.error('EMAIL ERROR → ', e.response?.text || e.message);
      throw new Error('Email sending failed.');
    }
  }
}
