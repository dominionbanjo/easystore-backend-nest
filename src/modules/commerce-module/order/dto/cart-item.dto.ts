import {
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty({ description: 'Product ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsNotEmpty()
  @IsUUID()
  product_id: string;

  @ApiPropertyOptional({ description: 'Product variant ID', example: '550e8400-e29b-41d4-a716-446655440001', nullable: true })
  @IsOptional()
  @ValidateIf((o) => o.variant_id !== null)
  @IsUUID()
  variant_id?: string | null;

  @ApiProperty({ description: 'Quantity of items', example: 2, minimum: 1 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ description: 'Selected size', example: 'Large', nullable: true })
  @IsOptional()
  @IsString()
  size?: string | null;

  @ApiPropertyOptional({ description: 'Selected color', example: 'Red', nullable: true })
  @IsOptional()
  @IsString()
  color?: string | null;
}
