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
import { InstallmentPayment } from './installment-payment.entity';

export type InstallmentPlanStatus =
  | 'active'
  | 'completed'
  | 'defaulted'
  | 'canceled'
  | 'refunding';

export type InstallmentMode = 'auto' | 'manual';

@Entity({ name: 'installment_plans' })
export class InstallmentPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ─── Order linkage (one plan = one vendor order) ─── */

  @Index('IDX_INSTALLMENT_ORDER_ID', { unique: true })
  @Column({ type: 'uuid' })
  order_id: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Index('IDX_INSTALLMENT_BUYER_ID')
  @Column({ type: 'uuid' })
  buyer_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User | null;

  @Index('IDX_INSTALLMENT_VENDOR_ID')
  @Column({ type: 'uuid' })
  vendor_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: User | null;

  @Index('IDX_INSTALLMENT_STORE_ID')
  @Column({ type: 'uuid', nullable: true })
  store_id: string | null;

  @ManyToOne(() => Store, { onDelete: 'SET NULL', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  /* ─── Money ─── */

  @Column({ type: 'bigint', default: 0 })
  total_kobo: number;

  @Column({ type: 'bigint', default: 0 })
  paid_kobo: number;

  @Column({ type: 'int', default: 0 })
  installments_total: number;

  @Column({ type: 'int', default: 0 })
  installments_paid: number;

  /* ─── Mode & schedule ─── */

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  mode: InstallmentMode;

  /** Paystack authorization code for auto-charge mode (encrypted at rest in production). */
  @Column({ type: 'text', nullable: true })
  authorization_code: string | null;

  @Column({ type: 'varchar', length: 64, default: 'fifty-fifty-2wk' })
  preset_id: string;

  @Index('IDX_INSTALLMENT_NEXT_DUE')
  @Column({ type: 'timestamptz', nullable: true })
  next_due_date: Date | null;

  /* ─── Lifecycle ─── */

  @Index('IDX_INSTALLMENT_STATUS')
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: InstallmentPlanStatus;

  @Column({ type: 'timestamptz', nullable: true })
  deposit_expires_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  defaulted_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  canceled_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at: Date | null;

  /** Auto-charge retries already attempted for the current due installment. */
  @Column({ type: 'int', default: 0 })
  charge_retries: number;

  /** Warning level already emitted for the current due installment (0 = none, 1, 2). */
  @Column({ type: 'int', default: 0 })
  warning_level: number;

  @Column({ type: 'text', nullable: true })
  admin_note: string | null;

  /* ─── Children ─── */

  @OneToMany(() => InstallmentPayment, (payment) => payment.plan)
  payments: InstallmentPayment[];

  /* ─── Timestamps ─── */

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
