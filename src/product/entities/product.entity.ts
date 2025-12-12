import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Store } from 'src/store/entities/store.entity';

export interface ProductImage {
  url: string;
  public_id: string;
}

export interface ProductGalleryItem {
  url: string;
  public_id: string;
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

  /* ────────────────────────────────────────────────
     category → product_categories(name)
     NOTE: This FK is via migration only
  ───────────────────────────────────────────────── */
  @Column({ type: 'varchar', length: 100 })
  category: string;

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

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  discount_price: number | null;

  @Column({ type: 'int', default: 0 })
  stock: number;

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

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  shipping_cost: number | null;

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
  @Column({ type: 'int', default: 0 })
  total_sold: number;

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
