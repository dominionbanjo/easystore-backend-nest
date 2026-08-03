import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsArray } from 'class-validator';

export class CreateOrderDto {
  @ApiProperty({
    description: 'Buyer user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  buyer_id: string;

  @ApiProperty({
    description: 'Order line items',
    type: 'array',
    items: { type: 'object' },
  })
  @IsArray()
  order_items: { product_id: string; quantity: number; variant_id?: string }[];

  @ApiPropertyOptional({
    description: 'Delivery address ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  delivery_address_id?: string;

  @ApiPropertyOptional({
    description: 'Delivery rate ID for shipping cost calculation',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID()
  delivery_rate_id?: string;

  @ApiPropertyOptional({
    description: 'Order notes',
    example: 'Leave at the gate',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
