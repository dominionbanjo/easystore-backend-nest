import { User } from 'src/modules/identity-module/users/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';

@Entity({ name: 'user_preferences' })
export class UserPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 🔗 USER RELATION (ONE PREFERENCE ROW PER USER — ON DELETE CASCADE)
  @Index('IDX_USER_PREFERENCE_USER_ID', { unique: true })
  @Column({ type: 'uuid' })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE', onUpdate: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // 🏷️ Explicit category interests (global category ids) selected by the user
  @Column({ type: 'text', array: true, default: () => 'ARRAY[]::text[]' })
  category_ids: string[];

  // 🕓 Timestamps
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
