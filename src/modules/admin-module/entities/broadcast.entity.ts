import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BroadcastTarget = 'all' | 'vendors' | 'users' | 'specific';
export type BroadcastStatus = 'pending' | 'sent' | 'failed';

@Entity({ name: 'broadcasts' })
export class Broadcast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({
    type: 'enum',
    enum: ['all', 'vendors', 'users', 'specific'],
    default: 'all',
  })
  target: BroadcastTarget;

  @Column({ type: 'jsonb', nullable: true })
  recipients: string[] | null; // List of emails or user IDs

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'boolean', default: false })
  is_recurring: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({
    type: 'enum',
    enum: ['daily', 'weekly', 'monthly'],
    nullable: true,
  })
  recurrence_type: 'daily' | 'weekly' | 'monthly' | null;

  @Column({ type: 'simple-array', nullable: true })
  recurrence_days: string[] | null; // e.g. ["1", "3", "5"] for Mon, Wed, Fri

  @Column({ type: 'varchar', length: 5, nullable: true })
  recurrence_time: string | null; // e.g. "14:00"

  @Column({ type: 'simple-array', nullable: true })
  recurrence_day_of_month: string[] | null; // 1-31 as strings

  @Column({ type: 'timestamptz', nullable: true })
  last_executed_at: Date | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'sent', 'failed'],
    default: 'pending',
  })
  status: BroadcastStatus;

  @Column({ type: 'text', nullable: true })
  failure_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
