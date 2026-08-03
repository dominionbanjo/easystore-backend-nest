import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SchoolZoneStatus =
  | 'pending'
  | 'active'
  | 'rejected'
  | 'restricted'
  | 'banned';

export const SCHOOL_ZONE_STATUSES: SchoolZoneStatus[] = [
  'pending',
  'active',
  'rejected',
  'restricted',
  'banned',
];

@Entity({ name: 'school_zones' })
export class SchoolZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_SCHOOL_ZONE_STATUS')
  @Column({
    type: 'enum',
    enum: ['pending', 'active', 'rejected', 'restricted', 'banned'],
    default: 'pending',
  })
  status: SchoolZoneStatus;

  @Index('IDX_SCHOOL_ZONE_NAME')
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Index('IDX_SCHOOL_ZONE_SLUG', { unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  slug: string;

  @Index('IDX_SCHOOL_ZONE_SUBDOMAIN', { unique: true })
  @Column({ type: 'varchar', length: 255, unique: true, nullable: true })
  subdomain: string | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  tagline: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  logo: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  logo_public_id: string | null;

  @Column({ type: 'text', nullable: true })
  cover_image: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  cover_image_public_id: string | null;

  /* School delivery location — injected into joining vendors' rates */
  @Index('IDX_SCHOOL_ZONE_STATE')
  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Index('IDX_SCHOOL_ZONE_LOCATION')
  @Column({ type: 'varchar', length: 100 })
  location: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact_email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contact_phone: string | null;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  /* School rep verification details (submitted at application) */
  @Column({ type: 'varchar', length: 255, nullable: true })
  department: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  course: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  student_id_number: string | null;

  @Column({ type: 'text', nullable: true })
  school_id_image: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  school_id_public_id: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  delivery_fee: string | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
