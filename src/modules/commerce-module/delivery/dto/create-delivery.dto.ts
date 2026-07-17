import { IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDeliveryDto {
  @ApiProperty({ description: 'Order ID to create delivery for', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  order_id: string;

  @ApiProperty({ description: 'Buyer user ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  buyer_id: string;

  @ApiProperty({ description: 'Vendor user ID', example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  vendor_id: string;

  @ApiPropertyOptional({ description: 'Assigned courier ID', example: '550e8400-e29b-41d4-a716-446655440003', nullable: true })
  @IsOptional()
  @IsUUID()
  courier_id?: string | null;

  @ApiPropertyOptional({ description: 'Delivery address', example: '123 Main Street', nullable: true })
  @IsOptional()
  @IsString()
  address?: string | null;

  @ApiPropertyOptional({ description: 'Delivery city', example: 'Lagos', nullable: true })
  @IsOptional()
  @IsString()
  city?: string | null;

  @ApiPropertyOptional({ description: 'Delivery state', example: 'LA', nullable: true })
  @IsOptional()
  @IsString()
  state?: string | null;

  @ApiPropertyOptional({ description: 'Delivery country', example: 'NG', nullable: true })
  @IsOptional()
  @IsString()
  country?: string | null;

  @ApiPropertyOptional({ description: 'Postal code', example: '100001', nullable: true })
  @IsOptional()
  @IsString()
  postal_code?: string | null;

  @ApiPropertyOptional({ description: 'Tracking number', example: 'TN123456789', nullable: true })
  @IsOptional()
  @IsString()
  tracking_number?: string | null;
}
