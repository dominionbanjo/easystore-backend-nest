import { Escrow } from 'src/modules/finance-module/escrow/entities/escrow.entity';
import { Payout } from 'src/modules/finance-module/payout/entities/payout.entity';
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
  OneToOne,
} from 'typeorm';
import { StoreStaff } from 'src/modules/vendor-module/store/entities/store-staff.entity';
import { ICartItem } from '../../cart/types/types';
import { Delivery } from '../../delivery/entities/delivery.entity';
import { UserAddress } from 'src/modules/identity-module/users/entities/user-address.entity';

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'failed'
  | 'canceled';

export type PaymentStatus =
  | 'pending'
  | 'success'
  | 'failed'
  | 'canceled'
  | 'refunded'
  | 'unpaid';

export type PaymentMethod = 'online' | 'offline' | 'panda' | 'cash' | 'transfer' | 'pos';

@Entity({ name: 'orders' })
export class Order {
  /* ───────────────────────────────────────────────
     PRIMARY KEY
  ─────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ───────────────────────────────────────────────
     RELATIONS → BUYER
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid', nullable: true })
  buyer_id: string | null;

  @ManyToOne(() => User, (user) => user.orders_as_buyer, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  @Index('IDX_ORDER_RECORDED_BY')
  @Column({ type: 'uuid', nullable: true })
  recorded_by: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'recorded_by' })
  recordedByUser: User | null;

  /* ───────────────────────────────────────────────
     RELATIONS → VENDOR
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid' })
  vendor_id: string;

  @ManyToOne(() => User, (user) => user.orders_as_vendor, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'vendor_id' })
  vendor: User;

  /* ───────────────────────────────────────────────
     RELATION → ESCROW
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid', nullable: true })
  escrow_id: string | null;

  @ManyToOne(() => Escrow, (escrow) => escrow.order, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'escrow_id' })
  escrow: Escrow | null;

  /* ───────────────────────────────────────────────
     RELATION → DELIVERY (ONE-TO-ONE)
     Delivery is the owning side with order_id FK
  ─────────────────────────────────────────────── */
  @OneToOne(() => Delivery, (delivery) => delivery.order, {
    nullable: true,
  })
  delivery: Delivery | null;

  /* ───────────────────────────────────────────────
     RELATION → DELIVERY ADDRESS
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid', nullable: true })
  delivery_address_id: string | null;

  @ManyToOne(() => UserAddress, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'delivery_address_id' })
  delivery_address: UserAddress | null;

  /* ───────────────────────────────────────────────
     ORDER AMOUNTS
  ─────────────────────────────────────────────── */
  @Column({ type: 'bigint', default: 0 })
  subtotal: number;

  @Column({ type: 'bigint', default: 0 })
  shipping_fee: number;

  @Column({ type: 'bigint', default: 0 })
  platform_fee: number;

  @Column({ type: 'bigint', default: 0, nullable: true })
  tax: number | null;

  @Column({ type: 'bigint', default: 0 })
  total: number;

  /* ───────────────────────────────────────────────
     PAYMENT INFO
  ─────────────────────────────────────────────── */
  @Column({
    type: 'varchar',
    length: 50,
    default: 'offline',
  })
  payment_method: PaymentMethod;

  @Index('IDX_ORDER_PAYMENT_REFERENCE')
  @Column({ type: 'varchar', length: 255, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'text', nullable: true })
  payment_url: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  payment_access_code: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: 'unpaid',
    nullable: true,
  })
  payment_status: PaymentStatus | null;

  /* ───────────────────────────────────────────────
     ORDER STATUS
  ─────────────────────────────────────────────── */
  @Index('IDX_ORDER_STATUS')
  @Column({
    type: 'varchar',
    length: 50,
    default: 'pending',
  })
  status: OrderStatus;

  /* ───────────────────────────────────────────────
     NOTES
  ─────────────────────────────────────────────── */
  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /* ───────────────────────────────────────────────
     ORDER ITEMS (JSONB)
  ─────────────────────────────────────────────── */
  @Column({ type: 'jsonb', default: [] })
  order_items: ICartItem[];

  /* ───────────────────────────────────────────────
     ANALYTICS FLAG
  ─────────────────────────────────────────────── */
  @Column({ type: 'boolean', default: false })
  analytics_processed: boolean;

  @Column({ type: 'boolean', default: false })
  confirmed: boolean;

  /* ───────────────────────────────────────────────
     RELATIONS → STORE
  ─────────────────────────────────────────────── */
  @Index('IDX_ORDER_STORE_ID')
  @Column({ type: 'uuid', nullable: true })
  store_id: string | null;

  @ManyToOne(() => Store, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'store_id' })
  store: Store | null;

  @OneToMany(() => Payout, (payout) => payout.order)
  payouts: Payout[];
  /* ───────────────────────────────────────────────
     TIMESTAMPS
  ─────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
