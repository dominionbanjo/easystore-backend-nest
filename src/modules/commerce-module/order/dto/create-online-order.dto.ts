import {
  IsArray,
  ValidateNested,
  IsEmail,
  IsNotEmpty,
  ArrayMinSize,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CartItemDto } from './cart-item.dto';

export class CreateOnlineOrderDto {
  @ApiProperty({
    description: 'Buyer email address',
    example: 'john@example.com',
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Order line items', type: [CartItemDto] })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  order_items: CartItemDto[];

  @ApiPropertyOptional({
    description: 'Delivery rate ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsString()
  delivery_rate_id?: string;

  @ApiPropertyOptional({
    description: 'Delivery address ID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsString()
  delivery_address_id?: string;
}
