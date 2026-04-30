import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { EmailLog } from '../entities/email-log.entity';
import { EmailService } from '../email.service';

@Injectable()
export class EmailRetryService {
  private readonly logger = new Logger(EmailRetryService.name);

  constructor(
    @InjectRepository(EmailLog)
    private readonly logRepo: Repository<EmailLog>,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Starting email retry job...');

    // Find failed emails with less than 5 attempts
    const failedEmails = await this.logRepo.find({
      where: {
        status: 'failed',
        attempts: LessThan(5),
      },
    });

    if (failedEmails.length === 0) {
      this.logger.log('No failed emails to retry.');
      return;
    }

    this.logger.log(`Retrying ${failedEmails.length} failed emails...`);

    for (const log of failedEmails) {
      try {
        await this.emailService.sendEmail({
          to: log.recipient,
          subject: log.subject,
          html: log.html_content,
          attachments: log.attachments,
          logId: log.id,
        });
        this.logger.log(`Successfully retried email to ${log.recipient}`);
      } catch (error) {
        this.logger.error(`Retry failed for email ${log.id}: ${error.message}`);
      }
    }
  }
}
