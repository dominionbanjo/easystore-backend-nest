import { Delivery } from 'src/modules/commerce-module/delivery/entities/delivery.entity';
import { Order } from 'src/modules/commerce-module/order/entities/order.entity';
import { Product } from 'src/modules/commerce-module/product/entities/product.entity';
import { Wishlist } from 'src/modules/commerce-module/wishlist/entities/wishlist.entity';
import { Escrow } from 'src/modules/finance-module/escrow/entities/escrow.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { UserAddress } from './user-address.entity';

/* ENUMS */
export type AccountType = 'user' | 'vendor' | 'admin' | 'staff';
export type AccountStatus = 'active' | 'pending' | 'restricted' | 'banned';
export type SalesChannel =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'other';
export type SignupMedium = 'signed' | 'google';

/* JSONB Address (DEPRECATED: Use UserAddress Entity instead) */
export interface IUserAddress {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
}

@Entity({ name: 'users' })
export class User {
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

  @Column({ type: 'text', nullable: true, select: false })
  password: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone_number: string | null;

  /* ACCOUNT */
  @Index('IDX_USER_ACCOUNT_TYPE')
  @Column({
    type: 'enum',
    enum: ['user', 'vendor', 'admin', 'staff'],
    default: 'user',
  })
  account_type: AccountType;

  @Column({
    type: 'enum',
    enum: ['active', 'pending', 'restricted', 'banned'],
    default: 'active',
  })
  account_status: AccountStatus;

  @OneToOne(() => Store, (store) => store.user)
  store: Store | null;

  @Index('IDX_USER_USERNAME', { unique: true })
  @Column({ type: 'varchar', length: 100 })
  username: string;

  /* SECURITY */
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

  @Index('IDX_USER_GOOGLE_ID')
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  google_id: string | null;

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

  /* ADDRESS */
  @Column({ type: 'jsonb', nullable: true })
  address: IUserAddress | null;

  @OneToMany(() => UserAddress, (address) => address.user, { cascade: true })
  addresses: UserAddress[];

  /* PAYOUT */
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

  @Column({ type: 'timestamptz', nullable: true })
  last_bank_update: Date | null;

  /* OTHER RELATIONS */
  @OneToMany(() => Escrow, (e) => e.buyer)
  escrows_as_buyer: Escrow[];

  @OneToMany(() => Escrow, (e) => e.vendor)
  escrows_as_vendor: Escrow[];

  @OneToMany(() => Order, (o) => o.buyer)
  orders_as_buyer: Order[];

  @OneToMany(() => Order, (o) => o.vendor)
  orders_as_vendor: Order[];

  @OneToMany(() => Product, (p) => p.vendor)
  products: Product[];

  @OneToMany(() => Wishlist, (w) => w.user)
  wishlist_items: Wishlist[];

  @OneToMany(() => Delivery, (d) => d.buyer)
  deliveries_as_buyer: Delivery[];

  @OneToMany(() => Delivery, (d) => d.vendor)
  deliveries_as_vendor: Delivery[];

  @OneToMany(() => Delivery, (d) => d.courier)
  deliveries_as_courier: Delivery[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
