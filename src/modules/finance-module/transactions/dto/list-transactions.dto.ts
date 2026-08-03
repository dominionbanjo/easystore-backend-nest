import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import * as transactionEntity from '../entities/transaction.entity';

export class ListTransactionsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by order ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  order_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by vendor ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @ApiPropertyOptional({
    enum: [
      'payment',
      'escrow_hold',
      'payout',
      'refund',
      'fee',
      'offline_payment',
      'order_created',
      'payment_offline',
      'payment_init',
      'payment_confirmed',
      'order_canceled',
      'payment_webhook',
      'offline_fulfillment',
    ],
    description: 'Filter by transaction type',
    example: 'payment',
  })
  @IsOptional()
  @IsEnum([
    'payment',
    'escrow_hold',
    'payout',
    'refund',
    'fee',
    'offline_payment',
    'order_created',
    'payment_offline',
    'payment_init',
    'payment_confirmed',
    'order_canceled',
    'payment_webhook',
    'offline_fulfillment',
  ])
  type?: transactionEntity.TransactionType;

  @ApiPropertyOptional({
    enum: ['pending', 'success', 'failed', 'reversed'],
    description: 'Filter by transaction status',
    example: 'success',
  })
  @IsOptional()
  @IsEnum(['pending', 'success', 'failed', 'reversed'])
  status?: transactionEntity.TransactionStatus;
}
