import { User } from 'src/modules/identity-module/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';

@Entity({ name: 'product_reviews' })
@Check(`"rating" >= 1 AND "rating" <= 5`)
export class ProductReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────────────────────────────────────────────
     PRODUCT (FK → products.id)
  ───────────────────────────────────────────────── */
  @Index('IDX_REVIEW_PRODUCT_ID')
  @Column({ type: 'uuid' })
  product_id: string;

  @ManyToOne(() => Product, (product) => product.reviews, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  /* ────────────────────────────────────────────────
     USER (FK → users.id)  ✅ FIXED
  ──────────────────────────────────────────────── */
  @Index('IDX_REVIEW_USER_ID')
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /* ────────────────────────────────────────────────
     REVIEW DATA
  ──────────────────────────────────────────────── */
  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
