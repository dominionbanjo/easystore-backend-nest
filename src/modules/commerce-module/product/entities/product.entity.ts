import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { ProductCategory } from '../../product-category/entities/product-category.entity';
import { ProductReview } from '../../review/entities/review.entity';

export interface ProductImage {
  url: string;
  public_id: string;
}

export interface ProductGalleryItem {
  url: string;
  public_id: string;
}

/* ────────────────────────────────────────────────
   PRODUCT STATUS
──────────────────────────────────────────────── */

export enum ProductStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity({ name: 'products' })
export class Product {
  /* ────────────────────────────────────────────────
     PRIMARY KEY
  ───────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────────────────────────────────────────────
     vendor_id → users(id) CASCADE
  ───────────────────────────────────────────────── */
  @Index('IDX_PRODUCT_VENDOR_ID')
  @Column({ type: 'uuid' })
  vendor_id: string;

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'vendor_id' })
  vendor: User;

  /* ────────────────────────────────────────────────
     store_id → stores(id) CASCADE
  ───────────────────────────────────────────────── */
  @Index('IDX_PRODUCT_STORE_ID')
  @Column({ type: 'uuid', nullable: true })
  store_id: string | null;

  @ManyToOne(() => Store, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'store_id' })
  store: Store;
  @Index('IDX_PRODUCT_CATEGORY_ID')
  @Column({ type: 'uuid' })
  category_id: string;

  @ManyToOne(() => ProductCategory, (category) => category.products, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category_ref: ProductCategory;

  @OneToMany(() => ProductReview, (review) => review.product)
  reviews: ProductReview[];
  /* ────────────────────────────────────────────────
     BASIC PRODUCT FIELDS
  ───────────────────────────────────────────────── */
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index('IDX_PRODUCT_SLUG')
  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'bigint' })
  price: number;

  @Column({ type: 'bigint', nullable: true })
  discount_price: number | null;

  @Column({ type: 'bigint', nullable: true })
  shipping_cost: number | null;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({
    type: 'boolean',
    generatedType: 'STORED',
    asExpression: 'stock < 1',
  })
  is_out_of_stock: boolean;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[] | null;

  /* ────────────────────────────────────────────────
     JSONB MEDIA FIELDS
  ───────────────────────────────────────────────── */
  @Column({ type: 'jsonb', nullable: true })
  image: ProductImage | null;

  @Column({ type: 'jsonb', nullable: true })
  gallery: ProductGalleryItem[] | null;

  /* ────────────────────────────────────────────────
     MORE JSONB FIELDS
  ───────────────────────────────────────────────── */
  @Column({ type: 'text', array: true, nullable: true })
  highlights: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  specs: Record<string, string> | null;

  @Column({ type: 'text', array: true, nullable: true })
  colors: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  sizes: string[] | null;

  /* ────────────────────────────────────────────────
     SHIPPING DETAILS
  ───────────────────────────────────────────────── */
  @Column({ type: 'text', nullable: true })
  shipping_note: string | null;

  @Column({ type: 'text', nullable: true })
  returns_note: string | null;

  @Index('IDX_PRODUCT_STATUS')
  @Column({
    type: 'enum',
    enum: ProductStatus,
    default: ProductStatus.ACTIVE,
  })
  status: ProductStatus;

  /* ────────────────────────────────────────────────
     RATINGS
  ───────────────────────────────────────────────── */
  @Column({ type: 'numeric', precision: 3, scale: 2, default: 0 })
  rating_average: number;

  @Column({ type: 'int', default: 0 })
  rating_count: number;

  @Column({ type: 'int', default: 0 })
  review_count: number;

  /* ────────────────────────────────────────────────
     SALES METRIC
  ───────────────────────────────────────────────── */
  @Index('IDX_PRODUCT_TOTAL_SOLD')
  @Column({ type: 'int', default: 0 })
  total_sold: number;

  @Column({ type: 'boolean', default: false })
  featured: boolean;

  @Index('IDX_PRODUCT_ON_SALE')
  @Column({ type: 'boolean', default: false })
  on_sale: boolean;

  /* ────────────────────────────────────────────────
     TIMESTAMPS
  ───────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;

  /* ────────────────────────────────────────────────
     FULL TEXT SEARCH VECTOR
     (set via migration + triggers)
  ───────────────────────────────────────────────── */
  @Column({ type: 'tsvector', nullable: true })
  search_vector: string | null;
}
