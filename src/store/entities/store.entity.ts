import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface IStoreAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
}

export interface IStoreCustomer {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  location: string | null;
  orders: number;
  spent: number;
  rating: number;
  last_order_date: string;
}

export interface IMonthlySales {
  month: string;
  year: number;
  amount: number;
}

export interface IMonthlyOrders {
  month: string;
  year: number;
  count: number;
}

export interface IMonthlyCustomers {
  month: string;
  year: number;
  count: number;
  list: string[];
}

export interface IAnalytics {
  sales: IMonthlySales[];
  orders: IMonthlyOrders[];
  customers: IMonthlyCustomers[];
}

@Entity({ name: 'stores' })
export class Store {
  /* ────────────────────────────────────────────────
     PRIMARY KEY
  ───────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────────────────────────────────────────────
     USER RELATION (FK)
  ───────────────────────────────────────────────── */
  @Index('IDX_STORE_USER_ID')
  @Column({ type: 'uuid' })
  user_id: string;

  /* NOTE:
     ON DELETE CASCADE is added via migration:
     ALTER TABLE stores
       ADD CONSTRAINT fk_store_user
       FOREIGN KEY (user_id)
       REFERENCES users(id)
       ON DELETE CASCADE ON UPDATE CASCADE;
  */

  /* ────────────────────────────────────────────────
     STORE NAME + SLUG
  ───────────────────────────────────────────────── */
  @Index('IDX_STORE_NAME')
  @Column({ type: 'varchar', length: 255, unique: true })
  store_name: string;

  @Index('IDX_STORE_SLUG')
  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  /* ────────────────────────────────────────────────
     CATEGORY + DESCRIPTION
  ───────────────────────────────────────────────── */
  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /* ────────────────────────────────────────────────
     IMAGES (including public_id)
  ───────────────────────────────────────────────── */
  @Column({ type: 'text', nullable: true })
  logo: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo_public_id: string | null;

  @Column({ type: 'text', nullable: true })
  cover_image: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cover_image_public_id: string | null;

  /* ────────────────────────────────────────────────
     CONTACT INFO
  ───────────────────────────────────────────────── */
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  /* ────────────────────────────────────────────────
     RATINGS
  ───────────────────────────────────────────────── */
  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating_average: number;

  @Column({ type: 'int', default: 0 })
  rating_count: number;

  @Column({ type: 'text', array: true, nullable: true })
  category_ids: string[] | null;

  /* ────────────────────────────────────────────────
     STORE METRICS
  ───────────────────────────────────────────────── */
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total_revenue: number;

  @Column({ type: 'int', default: 0 })
  total_orders: number;

  @Column({ type: 'int', default: 0 })
  total_products: number;

  @Column({ type: 'int', default: 0 })
  active_customers: number;

  @Column({ type: 'int', default: 0 })
  products_listed: number;

  /* ────────────────────────────────────────────────
     BANK INFORMATION
  ───────────────────────────────────────────────── */
  @Column({ type: 'varchar', length: 20, nullable: true })
  account_number: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  bank_code: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  bank_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  recipient_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  settlement_email: string | null;

  @Column({ type: 'boolean', default: false })
  payout_verified: boolean;

  /* ────────────────────────────────────────────────
     ANALYTICS + CACHED CUSTOMERS (JSONB)
  ───────────────────────────────────────────────── */
  @Column({ type: 'jsonb', nullable: true })
  analytics: IAnalytics | null;

  @Column({ type: 'jsonb', nullable: true })
  customers: IStoreCustomer[] | null;

  /* ────────────────────────────────────────────────
     ADDRESS (JSONB)
  ───────────────────────────────────────────────── */
  @Column({ type: 'jsonb', nullable: true })
  address: IStoreAddress | null;

  /* ────────────────────────────────────────────────
     TIMESTAMPS
  ───────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
