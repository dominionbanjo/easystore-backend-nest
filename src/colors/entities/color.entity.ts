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
  @Index('IDX_PRODUCT_COLOR_NAME')
  @Column({
    type: 'varchar',
    length: 100,
    unique: true,
  })
  name: string;

  /* ───────────────────────────────────────────────
     HEX VALUE (#FFFFFF)
  ─────────────────────────────────────────────── */
  @Index('IDX_PRODUCT_COLOR_HEX')
  @Column({
    type: 'varchar',
    length: 7,
    unique: true,
  })
  hex: string;

  /* ───────────────────────────────────────────────
     TIMESTAMPS
  ─────────────────────────────────────────────── */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
