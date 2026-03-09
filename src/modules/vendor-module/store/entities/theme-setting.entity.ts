import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { Store } from './store.entity';
import { StoreTemplate } from './store-template.entity';

@Entity({ name: 'theme_settings' })
export class ThemeSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  store_id: string;

  @OneToOne(() => Store, (store) => store.theme_setting, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ type: 'uuid' })
  template_id: string;

  @ManyToOne(() => StoreTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'template_id' })
  template: StoreTemplate;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  custom_config: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
