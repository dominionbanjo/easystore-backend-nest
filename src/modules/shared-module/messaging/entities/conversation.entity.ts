import { User } from 'src/modules/identity-module/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
} from 'typeorm';
import { Message } from './message.entity';

/* ────────────────────────────────────────────────
   CONVERSATION
   Represents a 1-to-1 direct message thread.
   participant_one_id is always the lexicographically
   smaller UUID so (A,B) and (B,A) map to the same row.
──────────────────────────────────────────────── */

@Entity({ name: 'conversations' })
@Unique('UQ_CONVERSATION_PARTICIPANTS', [
  'participant_one_id',
  'participant_two_id',
])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────── PARTICIPANTS ────────── */

  @Index('IDX_CONVERSATION_P1')
  @Column({ type: 'uuid' })
  participant_one_id: string; // lexicographically smaller UUID

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'participant_one_id' })
  participant_one: User;

  @Index('IDX_CONVERSATION_P2')
  @Column({ type: 'uuid' })
  participant_two_id: string; // lexicographically larger UUID

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'participant_two_id' })
  participant_two: User;

  /* ────────── UNREAD COUNTS ────────── */

  @Column({ type: 'int', default: 0 })
  participant_one_unread: number;

  @Column({ type: 'int', default: 0 })
  participant_two_unread: number;

  /* ────────── LAST MESSAGE PREVIEW ────────── */

  @Column({ type: 'text', nullable: true })
  last_message_preview: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_message_at: Date | null;

  /* ────────── MESSAGES ────────── */

  @OneToMany(() => Message, (m) => m.conversation)
  messages: Message[];

  /* ────────── TIMESTAMPS ────────── */

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
