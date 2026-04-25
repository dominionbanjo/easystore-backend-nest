import { Store } from 'src/modules/vendor-module/store/entities/store.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';

@Entity({ name: 'store_delivery_rates' })
export class StoreDeliveryRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /* STORE RELATION */
  @Index('IDX_STORE_DELIVERY_RATE_STORE_ID')
  @Column({ type: 'uuid' })
  store_id: string;

  @ManyToOne(() => Store, (store) => store.delivery_rates, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  /* LOCATION */
  @Index('IDX_STORE_DELIVERY_RATE_STATE')
  @Column({ type: 'varchar', length: 100 })
  state: string;

  @Index('IDX_STORE_DELIVERY_RATE_LOCATION')
  @Column({ type: 'varchar', length: 100 })
  location: string;

  /* PRICE */
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  fee: number;

  /* OPTIONAL RULES */
  @Column({ type: 'varchar', length: 50, nullable: true })
  duration: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /* TIMESTAMPS */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
