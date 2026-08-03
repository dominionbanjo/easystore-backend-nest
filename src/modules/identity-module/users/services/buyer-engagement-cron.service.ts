import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { BuyerEngagementMailService } from 'src/modules/shared-module/email/services/buyer-engagement-mail.service';

@Injectable()
export class BuyerEngagementCronService {
  private readonly logger = new Logger(BuyerEngagementCronService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly buyerMail: BuyerEngagementMailService,
  ) {}

  @Cron('0 10 * * 1,4') // Runs at 10:00 AM on Mondays and Thursdays
  async handleBuyerEngagement() {
    this.logger.log('Starting Buyer Engagement Cron Job...');

    // Find users who are NOT vendors (account_type = user)
    const buyers = await this.userRepo.find({
      where: { account_type: 'user' },
    });

    for (const buyer of buyers) {
      if (!buyer.email) continue;

      try {
        // Randomly alternate between templates to keep content fresh
        const useTrending = Math.random() > 0.5;

        if (useTrending) {
          await this.buyerMail.sendTrendingPrompt(
            buyer.email,
            buyer.first_name,
          );
        } else {
          await this.buyerMail.sendDiscoveryEmail(
            buyer.email,
            buyer.first_name,
          );
        }
      } catch (err) {
        this.logger.error(
          `Failed to send buyer engagement email to ${buyer.email}`,
          err,
        );
      }
    }

    this.logger.log('Buyer Engagement Cron Job completed.');
  }
}
