import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Escrow } from '../../escrow/entities/escrow.entity';

export type PayoutStatus = 'pending' | 'success' | 'failed' | 'reversed';

@Entity({ name: 'payouts' })
export class Payout {
  /* ───────────────────────────────────────────────
     PRIMARY KEY
  ─────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ───────────────────────────────────────────────
     RELATION: ORDER (nullable, SET NULL on delete)
  ─────────────────────────────────────────────── */
  @Index('IDX_PAYOUT_ORDER_ID')
  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  @ManyToOne(() => Order, (order) => order.payouts, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  /* ───────────────────────────────────────────────
     RELATION: ESCROW (nullable, SET NULL on delete)
  ─────────────────────────────────────────────── */
  @Index('IDX_PAYOUT_ESCROW_ID')
  @Column({ type: 'uuid', nullable: true })
  escrow_id: string | null;

  @ManyToOne(() => Escrow, (escrow) => escrow.payouts, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'escrow_id' })
  escrow: Escrow | null;

  /* ───────────────────────────────────────────────
     PAYOUT IDENTIFIERS (Paystack)
  ─────────────────────────────────────────────── */
  @Index('IDX_PAYOUT_TRANSFER_CODE')
  @Column({ type: 'varchar', length: 255, nullable: true })
  transfer_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transfer_reference: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipient_code: string | null;

  /* ───────────────────────────────────────────────
     TRANSACTION DETAILS
  ─────────────────────────────────────────────── */
  @Column({ type: 'bigint', default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 10, default: 'NGN', nullable: true })
  currency: string | null;

  @Index('IDX_PAYOUT_STATUS')
  @Column({
    type: 'varchar',
    length: 50,
    default: 'pending',
  })
  status: PayoutStatus;

  /* ───────────────────────────────────────────────
     METADATA (JSONB)
  ─────────────────────────────────────────────── */
  @Column({ type: 'jsonb', nullable: true })
  metadata: any | null;

  /* ───────────────────────────────────────────────
     TIMESTAMPS
  ─────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
