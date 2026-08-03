import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import * as deliveryEntity from '../entities/delivery.entity';

export class UpdateDeliveryStatusDto {
  @ApiProperty({
    enum: [
      'pending',
      'assigned',
      'in_transit',
      'delivered',
      'failed',
      'returned',
    ],
    description: 'New delivery status',
    example: 'in_transit',
  })
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
