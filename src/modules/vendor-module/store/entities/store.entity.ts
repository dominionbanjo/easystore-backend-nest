import { StoreDeliveryRate } from 'src/modules/vendor-module/store/entities/store-delivery-rate.entity';
import { Product } from 'src/modules/commerce-module/product/entities/product.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  OneToMany,
  OneToOne,
} from 'typeorm';

/* ────────────────────────────────────────────────
   JSON / INTERFACES
──────────────────────────────────────────────── */

// export interface IStoreAddress {
//   street?: string | null;
//   city?: string | null;
//   state?: string | null;
//   country?: string | null;
//   postal_code?: string | null;
// }

export interface IStoreCustomer {
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

/* ────────────────────────────────────────────────
   STORE ENTITY
──────────────────────────────────────────────── */

@Entity({ name: 'stores' })
export class Store {
  /* PRIMARY KEY */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_STORE_USER_ID', { unique: true })
  @Column({ type: 'uuid' })
  user_id: string;

  @OneToOne(() => User, (user) => user.store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /* STORE IDENTITY */
  @Index('IDX_STORE_NAME')
  @Column({ type: 'varchar', length: 255, unique: true })
  store_name: string;

  @Index('IDX_STORE_SLUG')
  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  /* CATEGORY + DESCRIPTION */
  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /* MEDIA */
  @Column({ type: 'text', nullable: true })
  logo: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo_public_id: string | null;

  @Column({ type: 'text', nullable: true })
  cover_image: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cover_image_public_id: string | null;

  /* CONTACT INFO */
  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_number: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  /* RATINGS */
  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating_average: number;

  @Column({ type: 'int', default: 0 })
  rating_count: number;

  @Column({ type: 'text', array: true, nullable: true })
  category_ids: string[] | null;

  /* STORE METRICS */
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

  /* BANK INFORMATION */
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

  // /* ANALYTICS (PRE-COMPUTED, NOT CALCULATED ON READ) */
  // @Column({
  //   type: 'jsonb',
  //   nullable: true,
  //   default: () => `'{"sales":[],"orders":[],"customers":[]}'`,
  // })
  // analytics: IAnalytics | null;

  // @Column({
  //   type: 'jsonb',
  //   nullable: true,
  //   default: () => `'[]'`,
  // })
  // customers: IStoreCustomer[] | null;

  // /* ADDRESS */
  // @Column({ type: 'jsonb', nullable: true })
  // address: IStoreAddress | null;

  /* ADDRESS */
  @Column({ type: 'varchar', length: 255, nullable: true })
  address_street: string | null;
  @Index('IDX_STORE_CITY')
  @Column({ type: 'varchar', length: 100, nullable: true })
  address_city: string | null;

  @Index('IDX_STORE_STATE')
  @Column({ type: 'varchar', length: 100, nullable: true })
  address_state: string | null;

  @Index('IDX_STORE_COUNTRY')
  @Column({ type: 'varchar', length: 100, nullable: true })
  address_country: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  address_postal_code: string | null;

  /* TIMESTAMPS */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  @OneToMany(() => Product, (product) => product.store)
  products: Product[];

  @OneToMany(() => StoreDeliveryRate, (rate) => rate.store)
  delivery_rates: StoreDeliveryRate[];
}
