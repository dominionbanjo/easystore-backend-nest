import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'product_colors' })
export class ProductColor {
  /* ───────────────────────────────────────────────
     PRIMARY KEY
  ─────────────────────────────────────────────── */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* ───────────────────────────────────────────────
     COLOR NAME
  ─────────────────────────────────────────────── */
  @Index('IDX_PRODUCT_COLOR_NAME_VENDOR', ['name', 'vendor_id'], {
    unique: true,
  })
  @Column({
    type: 'varchar',
    length: 100,
  })
  name: string;

  /* ───────────────────────────────────────────────
     HEX VALUE (#FFFFFF)
  ─────────────────────────────────────────────── */
  @Index('IDX_PRODUCT_COLOR_HEX_VENDOR', ['hex', 'vendor_id'], { unique: true })
  @Column({
    type: 'varchar',
    length: 7,
  })
  hex: string;

  /* ───────────────────────────────────────────────
     VENDOR ID (NULL = GLOBAL/DEFAULT)
  ─────────────────────────────────────────────── */
  @Index('IDX_PRODUCT_COLOR_VENDOR_ID')
  @Column({ type: 'uuid', nullable: true })
  vendor_id: string | null;

  /* ───────────────────────────────────────────────
     TIMESTAMPS
  ─────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
