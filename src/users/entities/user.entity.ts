import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';

import { Escrow } from 'src/escrow/entities/escrow.entity';
import { Order } from 'src/order/entities/order.entity';
import { Product } from 'src/product/entities/product.entity';
import { Wishlist } from 'src/wishlist/entities/wishlist.entity';
import { Delivery } from 'src/delivery/entities/delivery.entity';

/* ENUMS */
export type AccountType = 'user' | 'vendor' | 'admin';
export type SalesChannel =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'other';
export type SignupMedium = 'signed' | 'google';

/* JSONB Address Type */
export interface IUserAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
}

@Entity({ name: 'users' })
export class User {
  /* UUID PRIMARY KEY */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* BASIC INFO */
  @Column({ type: 'varchar', length: 100 })
  first_name: string;

  @Column({ type: 'varchar', length: 100 })
  last_name: string;

  @Index('IDX_USER_EMAIL')
  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  password: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_number: string | null;

  /* ACCOUNT TYPE ENUM */
  @Index('IDX_USER_ACCOUNT_TYPE')
  @Column({
    type: 'enum',
    enum: ['user', 'vendor', 'admin'],
    default: 'user',
  })
  account_type: AccountType;

  /* STORE INFO */
  @Index('IDX_USER_STORE_ID')
  @Column({ type: 'uuid', nullable: true })
  store_id: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  store_name: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  username: string | null;

  /* TOKENS + SECURITY */
  @Column({ type: 'int', default: 0 })
  token_version: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  referral_code: string | null;

  @Column({
    type: 'enum',
    enum: ['whatsapp', 'instagram', 'facebook', 'tiktok', 'other'],
    nullable: true,
  })
  current_sales_channel: SalesChannel | null;

  @Column({ type: 'boolean', default: true })
  agree_to_terms: boolean | null;

  @Column({ type: 'boolean', default: false })
  email_verified: boolean | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  password_token: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  password_token_expiration_date: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email_verification_code: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  email_verification_expiration: Date | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  otp: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  otp_expiration: Date | null;

  @Column({
    type: 'enum',
    enum: ['signed', 'google'],
    default: 'signed',
  })
  signup_medium: SignupMedium | null;

  /* MEDIA */
  @Column({ type: 'text', nullable: true })
  avatar: string | null;

  @Column({ type: 'text', nullable: true })
  avatar_public_id: string | null;

  /* RATINGS */
  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating_average: number | null;

  @Column({ type: 'int', default: 0 })
  rating_count: number | null;

  @Column({ type: 'int', default: 0 })
  review_count: number | null;

  /* ADDRESS JSONB */
  @Column({ type: 'jsonb', nullable: true })
  address: IUserAddress | null;

  /* PAYOUT INFO */
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

  /* RELATIONS → ESCROW */
  @OneToMany(() => Escrow, (escrow) => escrow.buyer)
  escrows_as_buyer: Escrow[];

  @OneToMany(() => Escrow, (escrow) => escrow.vendor)
  escrows_as_vendor: Escrow[];

  /* RELATIONS → ORDERS */
  @OneToMany(() => Order, (order) => order.buyer)
  orders_as_buyer: Order[];

  @OneToMany(() => Order, (order) => order.vendor)
  orders_as_vendor: Order[];

  /* RELATIONS → PRODUCTS */
  @OneToMany(() => Product, (product) => product.vendor)
  products: Product[];

  /* RELATIONS → WISHLIST */
  @OneToMany(() => Wishlist, (wish) => wish.user)
  wishlist_items: Wishlist[];

  /* RELATIONS → DELIVERIES */
  @OneToMany(() => Delivery, (delivery) => delivery.buyer)
  deliveries_as_buyer: Delivery[];

  @OneToMany(() => Delivery, (delivery) => delivery.vendor)
  deliveries_as_vendor: Delivery[];

  @OneToMany(() => Delivery, (delivery) => delivery.courier)
  deliveries_as_courier: Delivery[];

  /* TIMESTAMPS */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
