import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum OrderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PAID = 'paid',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus, enumName: 'OrderStatus', description: 'New order status', example: OrderStatus.PROCESSING })
  @IsEnum(OrderStatus, {
    message:
      'status must be one of: pending, processing, paid, in_transit, delivered, completed, failed, canceled',
  })
  status: OrderStatus;
}
