import {
  IsString,
  IsUUID,
  IsNumber,
  IsOptional,
  IsInt,
  IsArray,
  IsObject,
  Min,
  IsNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductOptionDto, ProductVariantDto } from './product-variants.dto';

export class CreateProductDto {
  @ApiProperty({
    description: 'Product category ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  category_id: string;

  @ApiProperty({
    description: 'Product name',
    example: 'Wireless Bluetooth Headphones',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'High-quality wireless headphones with noise cancellation',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Price in kobo',
    example: 2500000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @ApiPropertyOptional({
    description: 'Discount price in kobo',
    example: 1990000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_price?: number;

  @ApiPropertyOptional({
    description: 'Stock quantity',
    example: 50,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

  @ApiPropertyOptional({
    description: 'Product tags',
    example: ['electronics', 'audio', 'wireless'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Product highlights',
    example: ['Noise cancelling', '30hr battery', 'Bluetooth 5.0'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  highlights?: string[];

  @ApiPropertyOptional({
    description: 'Product specifications',
    example: { weight: '250g', color: 'Black' },
  })
  @IsObject()
  @IsOptional()
  specs?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Product options (e.g. size, color)',
    type: [ProductOptionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionDto)
  @IsOptional()
  options?: ProductOptionDto[];

  @ApiPropertyOptional({
    description: 'Product variants (SKU-level)',
    type: [ProductVariantDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  @IsOptional()
  variants?: ProductVariantDto[];

  @ApiPropertyOptional({
    description: 'Shipping information',
    example: 'Ships within 3-5 business days',
  })
  @IsString()
  @IsOptional()
  shipping_note?: string;

  @ApiPropertyOptional({
    description: 'Returns policy',
    example: '30-day return policy',
  })
  @IsString()
  @IsOptional()
  returns_note?: string;

  @ApiPropertyOptional({
    description: 'Product location',
    example: 'Lagos, Nigeria',
  })
  @IsString()
  @IsOptional()
  location?: string;
}
