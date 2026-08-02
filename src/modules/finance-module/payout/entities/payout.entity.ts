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
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';

export type PayoutStatus =
  | 'pending'
  | 'pending_manual'
  | 'success'
  | 'failed'
  | 'reversed';

export type PayoutType = 'auto' | 'manual';

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
     RELATION: VENDOR (nullable)
  ─────────────────────────────────────────────── */
  @Index('IDX_PAYOUT_VENDOR_ID')
  @Column({ type: 'uuid', nullable: true })
  vendor_id: string | null;

  @ManyToOne(() => User, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'vendor_id' })
  vendor: User | null;

  /* ───────────────────────────────────────────────
     RELATION: STORE (which store the payout belongs to)
  ─────────────────────────────────────────────── */
  @Index('IDX_PAYOUT_STORE_ID')
  @Column({ type: 'uuid', nullable: true })
  store_id: string | null;

  @ManyToOne(() => Store, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  /* ───────────────────────────────────────────────
     PAYOUT IDENTIFIERS (Paystack — used for auto mode)
  ─────────────────────────────────────────────── */
  @Index('IDX_PAYOUT_TRANSFER_CODE')
  @Column({ type: 'varchar', length: 255, nullable: true })
  transfer_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  transfer_reference: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  recipient_code: string | null;

  /* ───────────────────────────────────────────────
     PAYOUT TYPE
  ─────────────────────────────────────────────── */
  @Column({ type: 'varchar', length: 10, default: 'manual' })
  payout_type: PayoutType;

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
     MANUAL TRANSFER FIELDS
  ─────────────────────────────────────────────── */
  /** Timestamp when admin confirmed the manual bank transfer was made */
  @Column({ type: 'timestamptz', nullable: true })
  transferred_at: Date | null;

  /** Optional admin note when marking as transferred */
  @Column({ type: 'varchar', length: 500, nullable: true })
  admin_note: string | null;

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
