import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsNumber,
  IsEnum,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export enum PayoutType {
  MANUAL = 'manual',
  AUTOMATIC = 'automatic',
}

export class CreatePayoutDto {
  @ApiProperty({
    description: 'Order ID to create payout for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  order_id: string;

  @ApiProperty({
    description: 'Vendor user ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsUUID()
  vendor_id: string;

  @ApiProperty({
    description: 'Payout amount in kobo',
    example: 500000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({
    enum: PayoutType,
    enumName: 'PayoutType',
    description: 'Payout processing type',
    example: PayoutType.MANUAL,
  })
  @IsEnum(PayoutType)
  payout_type: PayoutType;

  @ApiPropertyOptional({
    description: 'Admin note for the payout',
    example: 'Monthly vendor payout',
  })
  @IsOptional()
  @IsString()
  note?: string;
}
