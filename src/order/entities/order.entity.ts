import { ICartItem } from 'src/cart/entities/cart.entity';
import { Delivery } from 'src/delivery/entities/delivery.entity';
import { Escrow } from 'src/escrow/entities/escrow.entity';
import { Payout } from 'src/payout/entities/payout.entity';
import { User } from 'src/users/entities/user.entity';
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

export type PaymentMethod = 'online' | 'offline';

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
  @Column({ type: 'uuid' })
  buyer_id: string;

  @ManyToOne(() => User, (user) => user.orders_as_buyer, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

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
     RELATION → DELIVERY
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid', nullable: true })
  delivery_id: string | null;

  @ManyToOne(() => Delivery, (delivery) => delivery.order, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'delivery_id' })
  delivery: Delivery | null;

  /* ───────────────────────────────────────────────
     ORDER AMOUNTS
  ─────────────────────────────────────────────── */
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  subtotal: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  shipping_fee: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  tax: number | null;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
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
