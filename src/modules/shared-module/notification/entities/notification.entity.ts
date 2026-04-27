import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type NotificationType = 'system' | 'vendor' | 'user' | 'alert' | 'announcement';
export type NotificationStatus = 'active' | 'read' | 'unread' | 'pending' | 'sent' | 'failed';

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Index('IDX_NOTIFICATION_TYPE')
  @Column({
    type: 'enum',
    enum: ['system', 'vendor', 'user', 'alert', 'announcement'],
    default: 'system',
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: ['active', 'read', 'unread', 'pending', 'sent', 'failed'],
    default: 'unread',
  })
  status: NotificationStatus;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'all',
  })
  target: 'all' | 'vendors' | 'users' | 'specific';

  @Column({ type: 'simple-array', nullable: true })
  recipients: string[] | null;

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
  recurrence_days: string[] | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  recurrence_time: string | null;

  @Column({ type: 'simple-array', nullable: true })
  recurrence_day_of_month: string[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_executed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null; // For single user targeted notification (legacy or specific read tracking)

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
