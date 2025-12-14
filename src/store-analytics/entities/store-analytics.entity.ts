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

import { Store } from 'src/store/entities/store.entity';

/* ────────────────────────────────────────────────
   ANALYTICS INTERFACES
──────────────────────────────────────────────── */

export interface MonthlySales {
  month: string; // Jan, Feb...
  year: number;
  amount: number;
}

export interface MonthlyOrders {
  month: string;
  year: number;
  count: number;
}

export interface MonthlyCustomers {
  month: string;
  year: number;
  count: number;
  customer_ids: string[];
}

/* ───────── TOP PRODUCTS ───────── */

export interface TopProductAnalytics {
  product_id: string;
  name: string;
  slug: string;
  image: string | null;
  total_sold: number;
  total_revenue: number;
}

/* ───────── CUSTOMER SNAPSHOT ───────── */

export interface StoreCustomerSnapshot {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  location: string | null;
  orders: number;
  spent: number;
  rating: number;
  last_order_date: string | null;
}

/* ───────── ROOT ANALYTICS JSON ───────── */

export interface StoreAnalyticsData {
  sales: MonthlySales[];
  orders: MonthlyOrders[];
  customers: MonthlyCustomers[];
  top_products: TopProductAnalytics[];
}

/* ────────────────────────────────────────────────
   STORE ANALYTICS ENTITY
──────────────────────────────────────────────── */

@Entity({ name: 'store_analytics' })
@Index('IDX_STORE_ANALYTICS_STORE_ID', ['store_id'], { unique: true })
export class StoreAnalytics {
  /* ────────────────────────────────────────────────
     PRIMARY KEY
  ───────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────────────────────────────────────────────
     STORE RELATION (1-to-1)
  ───────────────────────────────────────────────── */
  @Column({ type: 'uuid' })
  store_id: string;

  @OneToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  /* ────────────────────────────────────────────────
     SUMMARY METRICS (FAST ACCESS)
  ───────────────────────────────────────────────── */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total_revenue: number;

  @Column({ type: 'int', default: 0 })
  total_orders: number;

  @Column({ type: 'int', default: 0 })
  total_customers: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  conversion_rate: number;

  /* ────────────────────────────────────────────────
     PRE-COMPUTED ANALYTICS (JSONB)
  ───────────────────────────────────────────────── */
  @Column({
    type: 'jsonb',
    default: () =>
      `'{"sales":[], "orders":[], "customers":[], "top_products":[]}'`,
  })
  analytics: StoreAnalyticsData;

  /* ────────────────────────────────────────────────
     CUSTOMER SNAPSHOTS (JSONB)
  ───────────────────────────────────────────────── */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  customers: StoreCustomerSnapshot[];

  /* ────────────────────────────────────────────────
     LAST UPDATE TRACKING
  ───────────────────────────────────────────────── */
  @Column({ type: 'timestamptz', nullable: true })
  last_order_at: Date | null;

  /* ────────────────────────────────────────────────
     TIMESTAMPS
  ───────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
