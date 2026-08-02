import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SchoolZone } from './school-zone.entity';

@Entity({ name: 'school_zone_admins' })
@Index('IDX_SCHOOL_ZONE_ADMIN_PAIR', ['school_zone_id', 'user_id'], {
  unique: true,
})
export class SchoolZoneAdmin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_SCHOOL_ZONE_ADMIN_ZONE')
  @Column({ type: 'uuid' })
  school_zone_id: string;

  @ManyToOne(() => SchoolZone, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'school_zone_id' })
  school_zone: SchoolZone;

  @Index('IDX_SCHOOL_ZONE_ADMIN_USER')
  @Column({ type: 'uuid' })
  user_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
