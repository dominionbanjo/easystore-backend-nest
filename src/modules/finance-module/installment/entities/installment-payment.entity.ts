import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { InstallmentPlan } from './installment-plan.entity';

export type InstallmentPaymentStatus = 'pending' | 'paid' | 'refunded';

@Entity({ name: 'installment_payments' })
export class InstallmentPayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_INSTALLMENT_PAYMENT_PLAN_ID')
  @Column({ type: 'uuid' })
  plan_id: string;

  @ManyToOne(() => InstallmentPlan, (plan) => plan.payments, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'plan_id' })
  plan: InstallmentPlan | null;

  @Column({ type: 'int', default: 1 })
  index: number;

  @Column({ type: 'bigint', default: 0 })
  amount_kobo: number;

  /** Buyer-paid Paystack fee for this installment (1.5% + ₦100, capped ₦2,000). */
  @Column({ type: 'bigint', default: 0 })
  fee_kobo: number;

  @Index('IDX_INSTALLMENT_PAYMENT_DUE')
  @Column({ type: 'timestamptz', nullable: true })
  due_date: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  paid_at: Date | null;

  @Index('IDX_INSTALLMENT_PAYMENT_REF')
  @Column({ type: 'varchar', length: 255, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  payment_url: string | null;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: InstallmentPaymentStatus;

  @Column({ type: 'uuid', nullable: true })
  transaction_id: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  refunded_at: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
