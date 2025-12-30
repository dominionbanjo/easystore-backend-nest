import { IsEnum } from 'class-validator';
import * as deliveryEntity from '../entities/delivery.entity';

export class UpdateDeliveryStatusDto {
  @IsEnum([
    'pending',
    'assigned',
    'in_transit',
    'delivered',
    'failed',
    'returned',
  ])
  status: deliveryEntity.DeliveryStatus;
}
