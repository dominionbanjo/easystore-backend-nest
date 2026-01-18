import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Store } from '../../store/entities/store.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';

@Entity({ name: 'store_customers' })
@Index(['store_id', 'user_id'], { unique: true }) // one row per user per store
export class StoreCustomer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ───────── STORE ───────── */
  @Column({ type: 'uuid' })
  store_id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  /* ───────── USER (CUSTOMER) ───────── */
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /* ───────── METRICS (PER STORE) ───────── */

  @Column({ type: 'int', default: 0 })
  orders_count: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0 })
  total_spent: number;

  @Column({ type: 'numeric', precision: 2, scale: 1, default: 0 })
  rating: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_order_at: Date | null;

  /* ───────── DENORMALIZED SNAPSHOT (FAST UI) ───────── */

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
