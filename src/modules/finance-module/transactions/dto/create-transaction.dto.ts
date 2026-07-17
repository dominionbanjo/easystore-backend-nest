import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import * as transactionEntity from '../entities/transaction.entity';
import * as transactionEntity_1 from '../entities/transaction.entity';

export class CreateTransactionDto {
  @ApiProperty({ enum: ['payment', 'escrow_hold', 'payout', 'refund', 'fee', 'offline_payment', 'order_created', 'payment_offline', 'payment_init', 'payment_confirmed', 'order_canceled', 'payment_webhook', 'offline_fulfillment'], description: 'Transaction type', example: 'payment' })
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
  type: transactionEntity.TransactionType;

  @ApiProperty({ description: 'Transaction amount in kobo', example: 500000 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ description: 'Currency code', example: 'NGN' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ description: 'Transaction reference', example: 'TXN_abc123' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ description: 'Related order ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  order_id?: string;

  @ApiPropertyOptional({ description: 'Related escrow ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  escrow_id?: string;

  @ApiPropertyOptional({ description: 'User ID', example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiPropertyOptional({ description: 'Vendor ID', example: '550e8400-e29b-41d4-a716-446655440003' })
  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @ApiPropertyOptional({ description: 'Additional metadata', example: { payment_method: 'card', channel: 'web' } })
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Transaction description', example: 'Payment for order #ORD-001' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['pending', 'success', 'failed', 'reversed'], description: 'Transaction status', example: 'success' })
  @IsOptional()
  @IsEnum(['pending', 'success', 'failed', 'reversed'])
  status?: transactionEntity_1.TransactionStatus;
}
