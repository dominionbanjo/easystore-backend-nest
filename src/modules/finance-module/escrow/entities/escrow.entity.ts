import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Payout } from '../../payout/entities/payout.entity';

export type EscrowStatus =
  | 'pending'
  | 'funded'
  | 'delivered'
  | 'released'
  | 'disputed'
  | 'refunded';

export type EscrowPayoutType = 'auto' | 'manual';

@Entity({ name: 'escrows' })
export class Escrow {
  /* ───────────────────────────────────────────────
     PRIMARY KEY
  ─────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ───────────────────────────────────────────────
     RELATION → ORDER
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  @ManyToOne(() => Order, (order) => order.escrow, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  /* ───────────────────────────────────────────────
     RELATION → BUYER (USER)
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid' })
  buyer_id: string;

  @ManyToOne(() => User, (user) => user.escrows_as_buyer, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  /* ───────────────────────────────────────────────
     RELATION → VENDOR (USER)
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid' })
  vendor_id: string;

  @ManyToOne(() => User, (user) => user.escrows_as_vendor, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'vendor_id' })
  vendor: User;

  /* ───────────────────────────────────────────────
     RELATION → STORE (the store the order belongs to)
  ─────────────────────────────────────────────── */
  @Index('IDX_ESCROW_STORE_ID')
  @Column({ type: 'uuid', nullable: true })
  store_id: string | null;

  @ManyToOne(() => Store, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  /* ───────────────────────────────────────────────
   RELATION → PAYOUTS (ONE ESCROW → MANY PAYOUTS)
─────────────────────────────────────────────── */
  @OneToMany(() => Payout, (payout) => payout.escrow)
  payouts: Payout[];
  /* ───────────────────────────────────────────────
     ESCROW FIELDS
  ─────────────────────────────────────────────── */
  @Column({ type: 'int', default: 0 })
  trial_count: number;

  @Column({ type: 'boolean', default: false })
  disabled: boolean;

  @Column({ type: 'bigint', default: 0 })
  amount: number;

  /* Escrow service fee (3% of order total, capped at 300000 kobo = ₦3,000) */
  @Column({ type: 'bigint', default: 0 })
  escrow_fee: number;

  /* Payout mode: 'manual' = admin transfers manually; 'auto' = Paystack transfer */
  @Column({ type: 'varchar', length: 10, default: 'manual' })
  payout_type: EscrowPayoutType;

  @Column({ type: 'timestamptz', nullable: true })
  hold_until: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  release_code: string | null;

  @Index('IDX_ESCROW_STATUS')
  @Column({
    type: 'varchar',
    length: 50,
    default: 'pending',
  })
  status: EscrowStatus;

  @Column({ type: 'timestamptz', nullable: true })
  released_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  refunded_at: Date | null;

  /* ───────────────────────────────────────────────
     TIMESTAMPS
  ─────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
