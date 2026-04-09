import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from '../../store/entities/store.entity';

@Entity({ name: 'store_analytics' })
@Index('IDX_STORE_ANALYTICS_STORE_ID', ['store_id'], { unique: true })
export class StoreAnalytics {
  /* ────────────────────────────────────────────────
     PRIMARY KEY
  ──────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────────────────────────────────────────────
     STORE RELATION (1–1)
  ──────────────────────────────────────────────── */
  @Column({ type: 'uuid' })
  store_id: string;

  @OneToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  /* ────────────────────────────────────────────────
     LIFETIME SUMMARY METRICS
     (SOURCE OF TRUTH)
  ──────────────────────────────────────────────── */

  @Column({ type: 'bigint', default: 0 })
  total_revenue: number;

  @Column({ type: 'bigint', default: 0 })
  online_revenue: number;

  @Column({ type: 'bigint', default: 0 })
  offline_revenue: number;

  @Column({ type: 'int', default: 0 })
  total_orders: number;

  @Column({ type: 'int', default: 0 })
  total_customers: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  conversion_rate: number;

  /* ────────────────────────────────────────────────
     LAST ACTIVITY TRACKING
  ──────────────────────────────────────────────── */
  @Column({ type: 'timestamptz', nullable: true })
  last_order_at: Date | null;

  /* ────────────────────────────────────────────────
     TIMESTAMPS
  ──────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
