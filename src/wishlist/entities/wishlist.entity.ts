import { Product } from 'src/product/entities/product.entity';
import { User } from 'src/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'wishlist' })
export class Wishlist {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 🔗 USER RELATION (ON DELETE CASCADE)
  @Index('IDX_WISHLIST_USER_ID')
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // 🔗 PRODUCT RELATION (ON DELETE CASCADE)
  @Index('IDX_WISHLIST_PRODUCT_ID')
  @Column({ type: 'uuid' })
  product_id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  // 🏷️ Snapshot product name
  @Column({ type: 'varchar', length: 255 })
  name: string;

  // 🖼️ Snapshot image
  @Column({ type: 'text', nullable: true })
  image: string | null;

  // 💰 Snapshot price
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: number;

  // 🕓 Timestamps
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
