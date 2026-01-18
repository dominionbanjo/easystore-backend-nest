import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from '../../store/entities/store.entity';

@Entity({ name: 'store_monthly_analytics' })
@Index(['store_id', 'year', 'month'], { unique: true }) // ✅ ONE ROW PER MONTH
export class StoreMonthlyAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ───────── STORE ───────── */
  @Column({ type: 'uuid' })
  store_id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  /* ───────── TIME DIMENSION ───────── */
  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  month: number; // 1–12 (IMPORTANT: numeric, not string)

  /* ───────── METRICS ───────── */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  revenue: number;

  @Column({ type: 'int', default: 0 })
  orders: number;

  @Column({ type: 'int', default: 0 })
  unique_customers: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
