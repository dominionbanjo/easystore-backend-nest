import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TransactionListItemDto {
  @ApiProperty({ description: 'Transaction ID' })
  id: string;

  @ApiPropertyOptional({ description: 'Transaction reference' })
  reference: string | null;

  @ApiProperty({ description: 'Transaction type' })
  type: string;

  @ApiProperty({ description: 'Amount in kobo' })
  amount: number;

  @ApiProperty({ description: 'Currency code' })
  currency: string;

  @ApiProperty({ description: 'Transaction status' })
  status: string;

  @ApiPropertyOptional({ description: 'Transaction description' })
  description: string | null;

  @ApiProperty({ description: 'Whether transaction is flagged' })
  is_flagged: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;
}

export class PayoutListItemDto {
  @ApiProperty({ description: 'Payout ID' })
  id: string;

  @ApiPropertyOptional({ description: 'Order ID' })
  order_id: string | null;

  @ApiProperty({ description: 'Amount in kobo' })
  amount: number;

  @ApiProperty({ description: 'Payout status' })
  status: string;

  @ApiProperty({ description: 'Payout method type' })
  payout_type: string;

  @ApiPropertyOptional({ description: 'Transfer reference' })
  transfer_reference: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;

  @ApiPropertyOptional({ description: 'Date transferred' })
  transferred_at: Date | null;
}

export class EscrowListItemDto {
  @ApiProperty({ description: 'Escrow ID' })
  id: string;

  @ApiProperty({ description: 'Order ID' })
  order_id: string;

  @ApiProperty({ description: 'Escrow amount in kobo' })
  amount: number;

  @ApiProperty({ description: 'Escrow status' })
  status: string;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;
}
