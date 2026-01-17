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
     NAME (UNIQUE + REQUIRED)
  ───────────────────────────────────────────────── */
  @Index('IDX_CATEGORY_NAME')
  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  /* ────────────────────────────────────────────────
     SLUG (UNIQUE + REQUIRED)
  ───────────────────────────────────────────────── */
  @Index('IDX_CATEGORY_SLUG')
  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  /* ────────────────────────────────────────────────
     SELF-REFERENCING RELATION (PARENT CATEGORY)
  ───────────────────────────────────────────────── */
  @Index('IDX_CATEGORY_PARENT_ID')
  @Column({ type: 'uuid', nullable: true })
  parent_id: string | null;

  @ManyToOne(() => ProductCategory, (parent) => parent.children, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: ProductCategory | null;

  /* ────────────────────────────────────────────────
     CHILD CATEGORIES
  ───────────────────────────────────────────────── */
  @OneToMany(() => ProductCategory, (child) => child.parent)
  children: ProductCategory[];

  @OneToMany(() => Product, (product) => product.category_ref)
  products: Product[];
  /* ────────────────────────────────────────────────
     TIMESTAMPS
  ───────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
