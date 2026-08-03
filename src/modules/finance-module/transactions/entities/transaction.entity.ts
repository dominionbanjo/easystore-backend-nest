import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/modules/identity-module/users/entities/user.entity';

export type TransactionType =
  | 'payment'
  | 'escrow_hold'
  | 'payout'
  | 'refund'
  | 'fee'
  | 'offline_payment'
  | 'order_created'
  | 'payment_offline'
  | 'payment_init'
  | 'payment_confirmed'
  | 'order_canceled'
  | 'payment_webhook'
  | 'offline_fulfillment';

export type TransactionStatus = 'pending' | 'success' | 'failed' | 'reversed';

@Entity({ name: 'transactions' })
export class Transaction {
  /* ────────────────────────────────────────────────
     PRIMARY KEY
  ───────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────────────────────────────────────────────
     FOREIGN KEYS — All nullable + SET NULL on delete
  ───────────────────────────────────────────────── */

  @Index('IDX_TRANSACTION_ORDER_ID')
  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  @Index('IDX_TRANSACTION_ESCROW_ID')
  @Column({ type: 'uuid', nullable: true })
  escrow_id: string | null;

  @Index('IDX_TRANSACTION_USER_ID')
  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Index('IDX_TRANSACTION_VENDOR_ID')
  @Column({ type: 'uuid', nullable: true })
  vendor_id: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: User | null;

  /* NOTE:
    TypeORM does NOT include ON DELETE in the column definition.
    You will set ON DELETE SET NULL using migrations:
    
    ALTER TABLE transactions
    ADD CONSTRAINT fk_transaction_order
      FOREIGN KEY (order_id)
      REFERENCES orders(id)
      ON DELETE SET NULL;
  */

  /* ────────────────────────────────────────────────
     TRANSACTION TYPE + STATUS
  ───────────────────────────────────────────────── */

  @Index('IDX_TRANSACTION_TYPE')
  @Column({
    type: 'enum',
    enum: [
      'payment',
      'escrow_hold',
      'payout',
      'refund',
      'fee',
      'offline_payment',
      'order_created',
      'payment_offline',
      'payment_init',
      'payment_confirmed',
      'order_canceled',
      'payment_webhook',
      'offline_fulfillment',
    ],
  })
  type: TransactionType;

  @Column({ type: 'bigint', default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'NGN', nullable: true })
  currency: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reference: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index('IDX_TRANSACTION_STATUS')
  @Column({
    type: 'enum',
    enum: ['pending', 'success', 'failed', 'reversed'],
    default: 'pending',
  })
  status: TransactionStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ type: 'boolean', default: false })
  is_flagged: boolean;

  /* ────────────────────────────────────────────────
     TIMESTAMPS
  ───────────────────────────────────────────────── */

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
