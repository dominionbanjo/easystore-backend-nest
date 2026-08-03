import {
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCartDto {
  @ApiProperty({
    description: 'Product ID to add to cart',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  product_id: string;

  @ApiPropertyOptional({
    description: 'Product variant ID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID()
  variant_id?: string;

  @ApiProperty({ description: 'Quantity to add', example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Selected size',
    example: 'Large',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string | null;

  @ApiPropertyOptional({
    description: 'Selected color',
    example: 'Red',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string | null;
}
