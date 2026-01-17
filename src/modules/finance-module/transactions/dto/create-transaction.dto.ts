import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import * as transactionEntity from '../entities/transaction.entity';
import * as transactionEntity_1 from '../entities/transaction.entity';

export class CreateTransactionDto {
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

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsUUID()
  order_id?: string;

  @IsOptional()
  @IsUUID()
  escrow_id?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsUUID()
  vendor_id?: string;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['pending', 'success', 'failed', 'reversed'])
  status?: transactionEntity_1.TransactionStatus;
}
