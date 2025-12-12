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

import { User } from 'src/users/entities/user.entity';
import { Order } from 'src/order/entities/order.entity';
import { ICartItem } from 'src/cart/entities/cart.entity';

export type DeliveryStatus =
  | 'pending'
  | 'assigned'
  | 'in_transit'
  | 'delivered'
  | 'confirmed'
  | 'failed'
  | 'returned';

@Entity({ name: 'deliveries' })
export class Delivery {
  /* ───────────────────────────────────────────────
     PRIMARY KEY
  ─────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ───────────────────────────────────────────────
     RELATION → ORDER
     onDelete: SET NULL (matches schema)
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid', nullable: true })
  order_id: string | null;

  @ManyToOne(() => Order, (order) => order.delivery, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  /* ───────────────────────────────────────────────
     RELATION → COURIER (USER)
     Nullable + SET NULL
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid', nullable: true })
  courier_id: string | null;

  @ManyToOne(() => User, (user) => user.deliveries_as_courier, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'courier_id' })
  courier: User | null;

  /* ───────────────────────────────────────────────
     RELATION → BUYER (USER) - CASCADE
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid' })
  buyer_id: string;

  @ManyToOne(() => User, (user) => user.deliveries_as_buyer, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'buyer_id' })
  buyer: User;

  /* ───────────────────────────────────────────────
     RELATION → VENDOR (USER) - CASCADE
  ─────────────────────────────────────────────── */
  @Column({ type: 'uuid' })
  vendor_id: string;

  @ManyToOne(() => User, (user) => user.deliveries_as_vendor, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'vendor_id' })
  vendor: User;

  /* ───────────────────────────────────────────────
     ORDER ITEMS (JSONB)
  ─────────────────────────────────────────────── */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  order_items: ICartItem[];

  /* ───────────────────────────────────────────────
     ADDRESS FIELDS (nullable)
  ─────────────────────────────────────────────── */
  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  postal_code: string | null;

  /* ───────────────────────────────────────────────
     DELIVERY STATUS
  ─────────────────────────────────────────────── */
  @Index('IDX_DELIVERY_STATUS')
  @Column({
    type: 'varchar',
    length: 50,
    default: 'pending',
  })
  delivery_status: DeliveryStatus;

  /* ───────────────────────────────────────────────
     TRACKING + PROOF OF DELIVERY
  ─────────────────────────────────────────────── */
  @Column({ type: 'varchar', length: 100, nullable: true })
  tracking_number: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  confirmation_code: string | null;

  @Column({ type: 'text', nullable: true })
  proof_of_delivery_url: string | null;

  @Column({ type: 'text', nullable: true })
  proof_of_delivery_url_public_id: string | null;

  /* ───────────────────────────────────────────────
     DATES
  ─────────────────────────────────────────────── */
  @Column({ type: 'timestamptz', nullable: true })
  estimated_delivery: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  delivered_at: Date | null;

  /* ───────────────────────────────────────────────
     TIMESTAMPS
  ─────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
