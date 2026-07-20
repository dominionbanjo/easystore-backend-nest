import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { Product } from './product.entity';

@Entity({ name: 'product_variants' })
@Check('variant_stock_non_negative', 'stock >= 0')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_VARIANT_PRODUCT_ID')
  @Column({ type: 'uuid' })
  product_id: string;

  @ManyToOne(() => Product, (product) => product.variants, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'varchar', length: 255, nullable: true })
  sku: string | null;

  @Index('IDX_VARIANT_BARCODE', { unique: true })
  @Column({ type: 'varchar', length: 100, nullable: true })
  barcode: string | null;

  @Column({ type: 'jsonb' })
  combinations: Record<string, string>;

  @Column({ type: 'bigint' })
  price: number;

  @Column({ type: 'bigint', nullable: true })
  discount_price: number | null;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  image_url: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  image_public_id: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
