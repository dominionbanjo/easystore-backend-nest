import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';

import { User } from 'src/users/entities/user.entity';
import { ICartItem } from '../types/types';

@Entity({ name: 'cart' })
@Index('IDX_CART_USER_ID', ['user_id'], { unique: true }) // one cart per user
export class Cart {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────────────────────────────────────────────
     RELATION → USER
  ──────────────────────────────────────────────── */
  @Column({ type: 'uuid' })
  user_id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /* ────────────────────────────────────────────────
     CART ITEMS (JSONB)
  ──────────────────────────────────────────────── */
  @Column({
    type: 'jsonb',
    default: () => "'[]'",
  })
  cart_items: ICartItem[];

  /* ────────────────────────────────────────────────
     TIMESTAMPS
  ──────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
