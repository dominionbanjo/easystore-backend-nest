import { Injectable, Logger } from '@nestjs/common';
import SibApiV3Sdk from 'sib-api-v3-sdk';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog } from './entities/email-log.entity';

interface BrevoAuth {
  apiKey?: string;
}

interface BrevoApiClient {
  authentications: Record<string, BrevoAuth>;
}

interface BrevoTransactionalEmailRequest {
  sender: { email: string; name: string };
  to: { email: string }[];
  subject: string;
  htmlContent: string;
  attachment?: { content: string; name: string }[];
}

interface BrevoTransactionalEmailsApi {
  sendTransacEmail: (data: BrevoTransactionalEmailRequest) => Promise<unknown>;
}

interface BrevoSdk {
  ApiClient: { instance: BrevoApiClient };
  TransactionalEmailsApi: new () => BrevoTransactionalEmailsApi;
}

const brevo = SibApiV3Sdk as unknown as BrevoSdk;

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private client = brevo.ApiClient.instance;

  constructor(
    @InjectRepository(EmailLog)
    private readonly logRepo: Repository<EmailLog>,
  ) {
    const apiKey = this.client.authentications['api-key'];
    apiKey.apiKey = process.env.BREVO_API_KEY!;
  }

  async sendEmail({
    to,
    subject,
    html,
    attachments,
    logId,
  }: {
    to: string;
    subject: string;
    html: string;
    attachments?: { content: string; name: string }[];
    logId?: string; // Optional: if provided, update existing log
  }) {
    try {
      const transactional = new brevo.TransactionalEmailsApi();

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

      // If this was a retry, mark as sent
      if (logId) {
        await this.logRepo.update(logId, { status: 'sent' });
      }
    } catch (e: unknown) {
      const err = e as {
        response?: { body?: unknown; text?: string };
        message?: string;
      };
      const errorDetail: string = (err.response?.body ||
        err.response?.text ||
        err.message) as string;
      this.logger.error(`EMAIL ERROR → ${JSON.stringify(errorDetail)}`);

      // Log the failure for retry
      if (!logId) {
        await this.logRepo.save({
          recipient: to,
          subject,
          html_content: html,
          attachments,
          status: 'failed',
          attempts: 1,
          last_error: errorDetail,
        });
      } else {
        await this.logRepo.increment({ id: logId }, 'attempts', 1);
        await this.logRepo.update(logId, { last_error: errorDetail });
      }

      throw new Error(
        `Email sending failed: ${(e as { message?: string }).message}`,
      );
    }
  }
}
