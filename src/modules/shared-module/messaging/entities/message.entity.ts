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
} from 'typeorm';
import { Conversation } from './conversation.entity';
import { MessageRead } from './message-read.entity';

/* ────────────────────────────────────────────────
   MESSAGE
   Covers both:
     - Direct messages  (conversation_id SET, is_public = false)
     - Public chatroom  (conversation_id NULL, is_public = true)
──────────────────────────────────────────────── */

@Entity({ name: 'messages' })
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────── SENDER ────────── */

  @Index('IDX_MESSAGE_SENDER_ID')
  @Column({ type: 'uuid' })
  sender_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  /* ────────── RECIPIENT (DM only) ────────── */

  @Index('IDX_MESSAGE_RECIPIENT_ID')
  @Column({ type: 'uuid', nullable: true })
  recipient_id: string | null;

  @ManyToOne(() => User, {
    nullable: true,
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'recipient_id' })
  recipient: User | null;

  /* ────────── CONVERSATION (DM only) ────────── */

  @Index('IDX_MESSAGE_CONVERSATION_ID')
  @Column({ type: 'uuid', nullable: true })
  conversation_id: string | null;

  @ManyToOne(() => Conversation, (c) => c.messages, {
    nullable: true,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation | null;

  /* ────────── CHATROOM FLAG ────────── */

  @Index('IDX_MESSAGE_IS_PUBLIC')
  @Column({ type: 'boolean', default: false })
  is_public: boolean;

  /* ────────── CONTENT ────────── */

  @Column({ type: 'text' })
  content: string;

  /* ────────── PRODUCT ATTACHMENT (OPTIONAL) ────────── */
  // Stored as flat fields so the message card survives product deletion.

  @Column({ type: 'uuid', nullable: true })
  product_id: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  product_name: string | null;

  @Column({ type: 'text', nullable: true })
  product_image: string | null; // URL

  @Column({ type: 'varchar', length: 255, nullable: true })
  product_slug: string | null;

  /* ────────── DELIVERY / READ STATUS (DM only) ────────── */

  @Column({ type: 'timestamptz', nullable: true })
  delivered_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  read_at: Date | null;

  /* ────────── CHATROOM READS (public messages only) ────────── */

  @OneToMany(() => MessageRead, (r) => r.message)
  reads: MessageRead[];

  /* ────────── TIMESTAMPS ────────── */

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
