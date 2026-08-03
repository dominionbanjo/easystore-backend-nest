import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsNumber, Min } from 'class-validator';

export class CreateEscrowDto {
  @ApiProperty({
    description: 'Order ID for escrow',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  order_id: string;

  @ApiProperty({
    description: 'Buyer user ID',
    example: '550e8400-e29b-41d4-a716-446655440003',
  })
  @IsUUID()
  buyer_id: string;

  @ApiProperty({
    description: 'Vendor user ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  vendor_id: string;

  @ApiProperty({
    description: 'Escrow amount in kobo',
    example: 500000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount: number;
}
