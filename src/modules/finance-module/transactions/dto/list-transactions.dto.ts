import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import * as transactionEntity from '../entities/transaction.entity';

export class ListTransactionsDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID()
  order_id?: string;

  @IsOptional()
  @IsUUID()
  user_id?: string;

  @IsOptional()
  @IsUUID()
  vendor_id?: string;

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

  @IsOptional()
  @IsEnum(['pending', 'success', 'failed', 'reversed'])
  status?: transactionEntity.TransactionStatus;
}
