import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { User } from 'src/modules/identity-module/users/entities/user.entity';

@Entity({ name: 'store_reviews' })
@Check('store_review_rating_range', 'rating >= 1 AND rating <= 5')
export class StoreReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_STORE_REVIEW_VENDOR', { unique: true })
  @Column({ type: 'uuid' })
  vendor_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vendor_id' })
  vendor: User;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
