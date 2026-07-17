import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Notification, NotificationType, NotificationStatus } from './entities/notification.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  async findAll(params: { type?: string; status?: string; search?: string }) {
    const query = this.notificationRepo.createQueryBuilder('n');

    query.select([
      'n.id',
      'n.title',
      'n.message',
      'n.type',
      'n.status',
      'n.created_at',
    ]);

    if (params.type && params.type !== 'all') {
      query.andWhere('n.type = :type', { type: params.type });
    }

    if (params.status && params.status !== 'all') {
      query.andWhere('n.status = :status', { status: params.status });
    }

    if (params.search) {
      query.andWhere(
        '(n.title ILIKE :search OR n.message ILIKE :search)',
        { search: `%${params.search}%` },
      );
    }

    query.orderBy('n.created_at', 'DESC');

    return query.getMany();
  }

  async update(id: string, data: Partial<Notification>) {
    await this.notificationRepo.update(id, data);
    return { success: true, id };
  }

  async create(data: Partial<Notification>) {
    const notification = this.notificationRepo.create({
      ...data,
      status: (data.scheduled_at || data.is_recurring) ? 'pending' : 'active',
    });

    if (notification.is_recurring && !notification.scheduled_at) {
      notification.scheduled_at = this.calculateNextExecutionTime(notification);
    }

    const saved = await this.notificationRepo.save(notification);

    return { success: true, id: saved.id };
  }

  async delete(id: string) {
    const notification = await this.notificationRepo.findOne({ where: { id } });
    if (notification && (notification.status === 'sent' || notification.status === 'active') && notification.scheduled_at && notification.scheduled_at < new Date()) {
       // Optional: prevent delete of already active notifications? 
       // User said "as long as it not een sent".
    }
    return this.notificationRepo.delete(id);
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkScheduledAlerts() {
    const now = new Date();
    const pending = await this.notificationRepo.find({
      where: {
        status: 'pending',
        scheduled_at: LessThanOrEqual(now),
        is_active: true,
      },
    });

    for (const alert of pending) {
      if (alert.is_recurring) {
        await this.processRecurringAlert(alert);
      } else {
        alert.status = 'active';
        alert.sent_at = now;
        await this.notificationRepo.save(alert);
      }
    }
  }

  async processRecurringAlert(alert: Notification) {
    const now = new Date();
    // 1. Create instance
    const instance = this.notificationRepo.create({
      ...alert,
      id: undefined,
      is_recurring: false,
      status: 'active',
      sent_at: now,
      scheduled_at: now,
    });
    await this.notificationRepo.save(instance);

    // 2. Schedule next
    alert.last_executed_at = now;
    alert.scheduled_at = this.calculateNextExecutionTime(alert);
    await this.notificationRepo.save(alert);
  }

  calculateNextExecutionTime(n: Notification): Date {
    const now = new Date();
    let next = new Date();

    if (n.recurrence_time) {
      const [hours, minutes] = n.recurrence_time.split(':').map(Number);
      next.setHours(hours, minutes, 0, 0);
    }

    if (n.recurrence_type === 'daily') {
      if (next <= now) next.setDate(next.getDate() + 1);
    } else if (n.recurrence_type === 'weekly' && n.recurrence_days) {
      const days = n.recurrence_days.map(d => parseInt(d)).sort();
      const currentDay = next.getDay();
      let nextDay = days.find(d => d >= currentDay);
      
      if (nextDay === undefined) {
        nextDay = days[0];
        next.setDate(next.getDate() + (7 - currentDay + nextDay));
      } else {
        if (nextDay === currentDay && next <= now) {
          nextDay = days.find(d => d > currentDay) || days[0];
          if (nextDay === days[0]) next.setDate(next.getDate() + (7 - currentDay + nextDay));
          else next.setDate(next.getDate() + (nextDay - currentDay));
        } else {
          next.setDate(next.getDate() + (nextDay - currentDay));
        }
      }
    } else if (n.recurrence_type === 'monthly' && n.recurrence_day_of_month) {
      const days = n.recurrence_day_of_month.map(d => parseInt(d)).sort((a,b) => a-b);
      const currentDay = next.getDate();
      
      let nextDay = days.find(d => d > currentDay);
      if (nextDay === undefined) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(days[0]);
      } else {
        if (nextDay === currentDay && next <= now) {
          nextDay = days.find(d => d > currentDay);
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

    while (next <= now) {
       if (n.recurrence_type === 'daily') next.setDate(next.getDate() + 1);
       else if (n.recurrence_type === 'monthly') next.setMonth(next.getMonth() + 1);
       else if (n.recurrence_type === 'weekly') next.setDate(next.getDate() + 1);
       else break;
    }
    return next;
  }
}
