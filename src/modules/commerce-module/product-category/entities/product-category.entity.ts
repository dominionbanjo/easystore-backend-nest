import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Product } from '../../product/entities/product.entity';

@Entity({ name: 'product_categories' })
export class ProductCategory {
  /* ────────────────────────────────────────────────
     PRIMARY KEY
  ───────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ────────────────────────────────────────────────
     NAME (SEARCHABLE + UNIQUE)
  ───────────────────────────────────────────────── */

  @Index('IDX_CATEGORY_NAME_VENDOR', ['name', 'vendor_id'], { unique: true })
  @Index('idx_category_name_trgm', { synchronize: false }) // 🔥 Required for fuzzy search
  @Column({ type: 'varchar', length: 100 })
  name: string;

  /* ────────────────────────────────────────────────
     SLUG (URL + FAST LOOKUP)
  ───────────────────────────────────────────────── */

  @Index('IDX_CATEGORY_SLUG_VENDOR', ['slug', 'vendor_id'], { unique: true })
  @Column({ type: 'varchar', length: 120 })
  slug: string;

  /* ────────────────────────────────────────────────
     VENDOR ID (NULL = GLOBAL/DEFAULT)
  ───────────────────────────────────────────────── */

  @Index('IDX_CATEGORY_VENDOR_ID')
  @Column({ type: 'uuid', nullable: true })
  vendor_id: string | null;

  /* ────────────────────────────────────────────────
     SELF HIERARCHY
  ───────────────────────────────────────────────── */

  @Index('IDX_CATEGORY_PARENT_ID')
  @Column({ type: 'uuid', nullable: true })
  parent_id: string | null;

  @ManyToOne(() => ProductCategory, (parent) => parent.children, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent: ProductCategory | null;

  /* ────────────────────────────────────────────────
     CHILDREN
  ───────────────────────────────────────────────── */

  @OneToMany(() => ProductCategory, (child) => child.parent)
  children: ProductCategory[];

  /* ────────────────────────────────────────────────
     PRODUCTS
  ───────────────────────────────────────────────── */

  @OneToMany(() => Product, (product) => product.category_ref)
  products: Product[];

  /* ────────────────────────────────────────────────
     OPTIONAL: TREE DEPTH (Future performance)
     Helps avoid recursive queries later
  ───────────────────────────────────────────────── */

  @Column({ type: 'int', default: 0 })
  depth: number;

  /* ────────────────────────────────────────────────
     TIMESTAMPS
  ───────────────────────────────────────────────── */

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
