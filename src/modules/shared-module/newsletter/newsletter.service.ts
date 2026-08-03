import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NewsletterSubscriber } from './entities/newsletter-subscriber.entity';

@Injectable()
export class NewsletterService {
  constructor(
    @InjectRepository(NewsletterSubscriber)
    private readonly subscriberRepo: Repository<NewsletterSubscriber>,
  ) {}

  async subscribe(email: string, location?: string) {
    const existing = await this.subscriberRepo.findOne({ where: { email } });

    if (existing) {
      if (existing.is_active) {
        throw new ConflictException('Email is already subscribed');
      }
      // Re-subscribe
      existing.is_active = true;
      existing.unsubscribed_at = null;
      if (location) existing.location = location;
      await this.subscriberRepo.save(existing);
      return { message: 'Subscribed successfully', id: existing.id };
    }

    const subscriber = this.subscriberRepo.create({
      email,
      location: location ?? null,
    });
    await this.subscriberRepo.save(subscriber);
    return { message: 'Subscribed successfully', id: subscriber.id };
  }

  async unsubscribe(email: string) {
    const subscriber = await this.subscriberRepo.findOne({ where: { email } });
    if (!subscriber) return { message: 'Email not found' };
    subscriber.is_active = false;
    subscriber.unsubscribed_at = new Date();
    await this.subscriberRepo.save(subscriber);
    return { message: 'Unsubscribed successfully' };
  }
}
