import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Check,
} from 'typeorm';

@Entity({ name: 'product_reviews' })
@Check(`"rating" >= 1 AND "rating" <= 5`)
export class ProductReview {
  /* ────────────────────────────────────────────────
     PRIMARY KEY
  ───────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────────────────────────────────────────────
     FOREIGN KEYS
     product_id → products(id) (CASCADE)
  ───────────────────────────────────────────────── */
  @Index('IDX_REVIEW_PRODUCT_ID')
  @Column({ type: 'uuid' })
  product_id: string;

  /* NOTE: ON DELETE CASCADE is added via migration:
     ALTER TABLE product_reviews
       ADD CONSTRAINT fk_review_product
       FOREIGN KEY (product_id)
       REFERENCES products(id)
       ON DELETE CASCADE ON UPDATE CASCADE;
  */

  /* ────────────────────────────────────────────────
     user_id → users(id) (CASCADE)
  ───────────────────────────────────────────────── */
  @Index('IDX_REVIEW_USER_ID')
  @Column({ type: 'uuid' })
  user_id: string;

  /* Migration needed:

     ALTER TABLE product_reviews
       ADD CONSTRAINT fk_review_user
       FOREIGN KEY (user_id)
       REFERENCES users(id)
       ON DELETE CASCADE ON UPDATE CASCADE;
  */

  /* ────────────────────────────────────────────────
     RATING (1–5)
  ───────────────────────────────────────────────── */
  @Column({ type: 'int' })
  rating: number;

  /* ────────────────────────────────────────────────
     COMMENT (required)
  ───────────────────────────────────────────────── */
  @Column({ type: 'text' })
  comment: string;

  /* ────────────────────────────────────────────────
     TIMESTAMPS
  ───────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
