import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SchoolZone } from './school-zone.entity';

export type SchoolZoneMemberStatus =
  | 'pending'
  | 'active'
  | 'rejected'
  | 'suspended';

export const SCHOOL_ZONE_MEMBER_STATUSES: SchoolZoneMemberStatus[] = [
  'pending',
  'active',
  'rejected',
  'suspended',
];

@Entity({ name: 'school_zone_members' })
@Index('IDX_SCHOOL_ZONE_MEMBER_PAIR', ['school_zone_id', 'store_id'], {
  unique: true,
})
export class SchoolZoneMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_SCHOOL_ZONE_MEMBER_ZONE')
  @Column({ type: 'uuid' })
  school_zone_id: string;

  @ManyToOne(() => SchoolZone, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_zone_id' })
  school_zone: SchoolZone;

  @Index('IDX_SCHOOL_ZONE_MEMBER_STORE')
  @Column({ type: 'uuid' })
  store_id: string;

  @Index('IDX_SCHOOL_ZONE_MEMBER_STATUS')
  @Column({
    type: 'enum',
    enum: ['pending', 'active', 'rejected', 'suspended'],
    default: 'pending',
  })
  status: SchoolZoneMemberStatus;

  /* Student verification details */
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

  /* Delivery fee the vendor charges for this school's location */
  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  delivery_fee: number | null;

  @Column({ type: 'uuid', nullable: true })
  approved_by: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  approved_at: Date | null;

  @Column({ type: 'text', nullable: true })
  rejection_reason: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  requested_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
