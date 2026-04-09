import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';
import { User } from 'src/modules/identity-module/users/entities/user.entity';
import { Order } from '../../order/entities/order.entity';

@Entity({ name: 'product_customers' })
@Index('IDX_PRODUCT_CUSTOMER', ['product_id', 'user_id', 'vendor_id'])
export class ProductCustomer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @Column({ type: 'uuid' })
  vendor_id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  order_id: string;

  @ManyToOne(() => Order, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ type: 'varchar', nullable: true })
  customer_name: string;

  @Column({ type: 'varchar', nullable: true })
  customer_email: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
