import { IsEnum } from 'class-validator';

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
  @IsEnum(OrderStatus, {
    message:
      'status must be one of: pending, processing, paid, in_transit, delivered, completed, failed, canceled',
  })
  status: OrderStatus;
}
