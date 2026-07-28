import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Store } from './store.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';

export type StaffStatus = 'active' | 'suspended' | 'invited';

@Entity({ name: 'store_staff' })
export class StoreStaff {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_STAFF_STORE')
  @Column({ type: 'uuid' })
  store_id: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Index('IDX_STAFF_USER', { unique: true })
  @Column({ type: 'uuid' })
  user_id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 50, default: 'invited' })
  status: StaffStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  invite_token: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  invite_expires_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  last_login_at: Date | null;

  @Column({ type: 'text', array: true, nullable: true })
  permissions: string[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
