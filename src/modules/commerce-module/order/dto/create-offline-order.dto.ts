import {
  IsArray,
  ValidateNested,
  IsOptional,
  IsNumber,
  Min,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CartItemDto } from './cart-item.dto';

export class CreateOfflineOrderDto {
  @ApiProperty({ description: 'Order line items', type: [CartItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  order_items: CartItemDto[];

  @ApiPropertyOptional({ description: 'Tax amount in kobo', example: 5000, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @ApiPropertyOptional({ description: 'Order notes', example: 'Paid with cash' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Delivery address ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsString()
  delivery_address_id?: string;
}
