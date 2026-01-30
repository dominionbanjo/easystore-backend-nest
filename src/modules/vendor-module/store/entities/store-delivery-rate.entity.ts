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
  @Index('IDX_STORE_DELIVERY_RATE_COUNTRY')
  @Column({ type: 'varchar', length: 100 })
  country: string;

  @Index('IDX_STORE_DELIVERY_RATE_STATE')
  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Index('IDX_STORE_DELIVERY_RATE_CITY')
  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  /* PRICE */
  @Column({ type: 'numeric', precision: 10, scale: 2 })
  price: number;

  /* OPTIONAL RULES */
  @Column({ type: 'int', nullable: true })
  estimated_days: number | null;

  /* TIMESTAMPS */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
