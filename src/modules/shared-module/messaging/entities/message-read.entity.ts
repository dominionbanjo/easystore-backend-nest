import { User } from 'src/modules/identity-module/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Unique,
} from 'typeorm';
import { Message } from './message.entity';

/* ────────────────────────────────────────────────
   MESSAGE READ
   Tracks which users have read a given PUBLIC chatroom message.
   For DMs read status lives directly on Message.read_at.
──────────────────────────────────────────────── */

@Entity({ name: 'message_reads' })
@Unique('UQ_MESSAGE_READ', ['message_id', 'user_id'])
export class MessageRead {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────── MESSAGE ────────── */

  @Index('IDX_MESSAGE_READ_MESSAGE_ID')
  @Column({ type: 'uuid' })
  message_id: string;

  @ManyToOne(() => Message, (m) => m.reads, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  /* ────────── USER ────────── */

  @Index('IDX_MESSAGE_READ_USER_ID')
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /* ────────── TIMESTAMP ────────── */

  @CreateDateColumn({ type: 'timestamptz' })
  read_at: Date;
}
