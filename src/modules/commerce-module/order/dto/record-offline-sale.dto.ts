import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class OfflineSaleItemDto {
  @ApiProperty({ description: 'Product ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  product_id: string;

  @ApiPropertyOptional({ description: 'Product variant ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsString()
  variant_id?: string;

  @ApiProperty({ description: 'Quantity sold', example: 1, minimum: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class RecordVendorOfflineSaleDto {
  @ApiProperty({ description: 'List of items sold', type: [OfflineSaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineSaleItemDto)
  items: OfflineSaleItemDto[];

  @ApiPropertyOptional({ description: 'Customer name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  customer_name?: string;

  @ApiPropertyOptional({ description: 'Customer email', example: 'john@example.com' })
  @IsOptional()
  @IsString()
  customer_email?: string;

  @ApiPropertyOptional({ description: 'Sale notes', example: 'Sold at physical store' })
  @IsOptional()
  @IsString()
  notes?: string;
}
