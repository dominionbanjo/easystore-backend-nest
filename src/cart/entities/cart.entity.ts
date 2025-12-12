import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export interface ICartItem {
  product_id: string;
  name: string;
  slug: string;
  price: number;
  discount_price: number | null;
  image: string | null;
  quantity: number;
  size: string | null;
  color: string | null;
  shipping_cost: number | null;
}

@Entity({ name: 'cart' })
export class Cart {
  /* ───────────────────────────────────────────────
     PRIMARY KEY
  ─────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ───────────────────────────────────────────────
     RELATION → USER (ONE CART PER USER)
  ─────────────────────────────────────────────── */
  @Index('IDX_CART_USER_ID')
  @Column({ type: 'uuid', unique: true })
  user_id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /* ───────────────────────────────────────────────
     CART ITEMS — JSONB ARRAY
  ─────────────────────────────────────────────── */
  @Column({ type: 'jsonb', default: [] })
  cart_items: ICartItem[];

  /* ───────────────────────────────────────────────
     TIMESTAMPS
  ─────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
