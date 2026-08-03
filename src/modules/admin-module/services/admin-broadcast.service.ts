import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Broadcast } from '../entities/broadcast.entity';
import { CreateBroadcastDto } from '../dto/create-broadcast.dto';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { EmailService } from 'src/modules/shared-module/email/email.service';
import { EmailTemplateService } from 'src/modules/shared-module/email/email-template.service';

@Injectable()
export class AdminBroadcastService {
  private readonly logger = new Logger(AdminBroadcastService.name);

  constructor(
    @InjectRepository(Broadcast)
    private broadcastRepo: Repository<Broadcast>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private emailService: EmailService,
    private tplService: EmailTemplateService,
  ) {}

  async createBroadcast(dto: CreateBroadcastDto) {
    const broadcast = this.broadcastRepo.create({
      ...dto,
      scheduled_at: dto.scheduled_at ? new Date(dto.scheduled_at) : null,
      status: 'pending',
    });

    if (broadcast.is_recurring && !broadcast.scheduled_at) {
      broadcast.scheduled_at = this.calculateNextExecutionTime(broadcast);
    }

    const saved = await this.broadcastRepo.save(broadcast);

    // ONLY send immediately if NOT scheduled and NOT recurring
    // (If scheduled_at was provided but is now/past, it will be picked up by the next Cron run)
    if (!dto.scheduled_at && !broadcast.is_recurring) {
      void this.sendBroadcast(saved.id);
    }

    return saved;
  }

  async updateBroadcast(id: string, dto: Partial<CreateBroadcastDto>) {
    const broadcast = await this.broadcastRepo.findOne({
      where: { id },
      select: { id: true, status: true, scheduled_at: true },
    });
    if (!broadcast) throw new BadRequestException('Broadcast not found');
    if (
      broadcast.status !== 'pending' ||
      (broadcast.scheduled_at && broadcast.scheduled_at < new Date())
    ) {
      throw new BadRequestException(
        'Cannot edit a broadcast that has been sent or is currently being processed',
      );
    }

    const updated = {
      ...dto,
      scheduled_at: dto.scheduled_at
        ? new Date(dto.scheduled_at)
        : broadcast.scheduled_at,
    };

    await this.broadcastRepo.update(id, updated);
    return { success: true };
  }

  async findAll() {
    return this.broadcastRepo.find({
      order: { created_at: 'DESC' },
    });
  }

  async deleteBroadcast(id: string) {
    const exists = await this.broadcastRepo.exists({ where: { id } });
    if (!exists) throw new NotFoundException('Broadcast not found');

    const broadcast = await this.broadcastRepo.findOne({
      where: { id },
      select: { id: true, status: true },
    });

    if (broadcast!.status === 'pending') {
      await this.broadcastRepo.delete(id);
      return { success: true, message: 'Broadcast deleted successfully' };
    }
    return {
      message: 'Cannot delete a broadcast that is already sent or processing',
    };
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkScheduledBroadcasts() {
    const now = new Date();
    const pending = await this.broadcastRepo.find({
      where: {
        status: 'pending',
        scheduled_at: LessThanOrEqual(now),
        is_active: true,
      },
    });

    if (pending.length > 0) {
      this.logger.log(
        `Found ${pending.length} scheduled broadcasts to process`,
      );
      for (const b of pending) {
        if (b.is_recurring) {
          await this.processRecurringBroadcast(b);
        } else {
          await this.sendBroadcast(b.id);
        }
      }
    }
  }

  async processRecurringBroadcast(b: Broadcast) {
    try {
      // 1. Create a "shot" (non-recurring copy) to track this specific execution history
      const shot = this.broadcastRepo.create({
        ...b,
        id: undefined,
        is_recurring: false,
        scheduled_at: new Date(),
        status: 'pending',
      });
      const savedShot = await this.broadcastRepo.save(shot);
      await this.sendBroadcast(savedShot.id);

      // 2. Update the parent broadcast's next execution time
      b.last_executed_at = new Date();
      b.scheduled_at = this.calculateNextExecutionTime(b);
      await this.broadcastRepo.save(b);
    } catch (err: unknown) {
      this.logger.error(
        `Recurring broadcast failed: ${b.subject}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  calculateNextExecutionTime(b: Broadcast): Date {
    const now = new Date();
    const next = new Date();

    // Set time if provided (format "HH:mm")
    if (b.recurrence_time) {
      const [hours, minutes] = b.recurrence_time.split(':').map(Number);
      next.setHours(hours, minutes, 0, 0);
    }

    if (b.recurrence_type === 'daily') {
      if (next <= now) next.setDate(next.getDate() + 1);
    } else if (b.recurrence_type === 'weekly' && b.recurrence_days) {
      const days = b.recurrence_days.map((d) => parseInt(d)).sort();
      const currentDay = next.getDay();

      let nextDay = days.find((d) => d > currentDay);
      if (nextDay === undefined) {
        nextDay = days[0];
        next.setDate(next.getDate() + (7 - currentDay + nextDay));
      } else {
        // If it's today but already passed the time, move to next selected day
        if (nextDay === currentDay && next <= now) {
          nextDay = days.find((d) => d > currentDay) || days[0];
          if (nextDay === days[0])
            next.setDate(next.getDate() + (7 - currentDay + nextDay));
          else next.setDate(next.getDate() + (nextDay - currentDay));
        } else {
          next.setDate(next.getDate() + (nextDay - currentDay));
        }
      }
    } else if (b.recurrence_type === 'monthly' && b.recurrence_day_of_month) {
      const days = b.recurrence_day_of_month
        .map((d) => parseInt(d))
        .sort((a, b) => a - b);
      const currentDay = next.getDate();

      let nextDay = days.find((d) => d > currentDay);
      if (nextDay === undefined) {
        // Move to first day of next month
        next.setMonth(next.getMonth() + 1);
        next.setDate(days[0]);
      } else {
        // If it's today but time passed, check if there's another day this month
        if (nextDay === currentDay && next <= now) {
          nextDay = days.find((d) => d > currentDay);
          if (nextDay === undefined) {
            next.setMonth(next.getMonth() + 1);
            next.setDate(days[0]);
          } else {
            next.setDate(nextDay);
          }
        } else {
          next.setDate(nextDay);
        }
      }
    }

    // Safety loop to ensure future date
    while (next <= now) {
      if (b.recurrence_type === 'daily') next.setDate(next.getDate() + 1);
      else if (b.recurrence_type === 'weekly' && b.recurrence_days) {
        // This should be handled by the logic above, but for safety:
        next.setDate(next.getDate() + 1);
        // (Recursion would be cleaner but loop is fine here if we re-check day)
      } else if (b.recurrence_type === 'monthly')
        next.setMonth(next.getMonth() + 1);
      else break;
    }

    return next;
  }

  async sendBroadcast(id: string) {
    const broadcast = await this.broadcastRepo.findOne({ where: { id } });
    if (!broadcast || broadcast.status !== 'pending') return;

    try {
      this.logger.log(`Starting broadcast: ${broadcast.subject}`);

      // 1. Resolve Recipient Emails
      let emails: string[] = [];

      if (broadcast.target === 'all') {
        const users = await this.userRepo.find({ select: ['email'] });
        emails = users.map((u) => u.email);
      } else if (broadcast.target === 'vendors') {
        const vendors = await this.userRepo.find({
          where: { account_type: 'vendor' },
          select: ['email'],
        });
        emails = vendors.map((v) => v.email);
      } else if (broadcast.target === 'users') {
        const users = await this.userRepo.find({
          where: { account_type: 'user' },
          select: ['email'],
        });
        emails = users.map((u) => u.email);
      } else if (broadcast.target === 'specific' && broadcast.recipients) {
        emails = broadcast.recipients;
      }

      if (emails.length === 0) {
        broadcast.status = 'sent';
        broadcast.sent_at = new Date();
        broadcast.failure_reason = 'No recipients found';
        await this.broadcastRepo.save(broadcast);
        return;
      }

      // 2. Wrap Body in Template
      const html = this.tplService.wrapper(broadcast.subject, broadcast.body);

      // 3. Send Emails (in chunks of 50 to prevent timeout/limit issues)
      const chunkSize = 50;
      let successCount = 0;
      let failureCount = 0;

      for (let i = 0; i < emails.length; i += chunkSize) {
        const chunk = emails.slice(i, i + chunkSize);
        const results = await Promise.allSettled(
          chunk.map((email) =>
            this.emailService.sendEmail({
              to: email,
              subject: broadcast.subject,
              html,
            }),
          ),
        );

        results.forEach((res, idx) => {
          if (res.status === 'fulfilled') {
            successCount++;
          } else {
            failureCount++;
            this.logger.error(
              `Failed to send broadcast to ${chunk[idx]}: ${
                res.reason instanceof Error
                  ? res.reason.message
                  : String(res.reason)
              }`,
            );
          }
        });
      }

      broadcast.status = 'sent';
      broadcast.sent_at = new Date();
      if (failureCount > 0) {
        broadcast.failure_reason = `Sent to ${successCount} recipients. ${failureCount} failed.`;
      }
      await this.broadcastRepo.save(broadcast);

      this.logger.log(
        `Broadcast completed. Success: ${successCount}, Failures: ${failureCount}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        `Broadcast failed: ${broadcast.subject}`,
        error instanceof Error ? error.stack : undefined,
      );
      broadcast.status = 'failed';
      broadcast.failure_reason =
        error instanceof Error ? error.message : String(error);
      await this.broadcastRepo.save(broadcast);
    }
  }
}
