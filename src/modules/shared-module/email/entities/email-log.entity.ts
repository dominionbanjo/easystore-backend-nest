import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('email_logs')
@Index(['status', 'attempts']) // Composite index for the cron job query
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  recipient: string;

  @Column()
  subject: string;

  @Column('text')
  html_content: string;

  @Column('jsonb', { nullable: true })
  attachments: any;

  @Index()
  @Column({ default: 'pending' })
  status: 'pending' | 'sent' | 'failed';

  @Column({ default: 0 })
  attempts: number;

  @Column({ nullable: true })
  last_error: string;

  @Index()
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
