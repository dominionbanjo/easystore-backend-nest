import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  IsArray,
  IsObject,
  IsUUID,
  Min,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ProductOptionDto {
  @ApiProperty({ description: 'Option name', example: 'Size' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Option values',
    example: ['Small', 'Medium', 'Large'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  values: string[];
}

export class ProductVariantDto {
  @ApiPropertyOptional({
    description: 'Variant ID (for updates)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ description: 'SKU code', example: 'HD-WHITE-M' })
  @IsString()
  @IsOptional()
  sku?: string;

  @ApiPropertyOptional({
    description: 'Variant barcode/UPC',
    example: '8901234567891',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  barcode?: string;

  @ApiProperty({
    description: 'Variant combination map',
    example: { Color: 'White', Size: 'M' },
  })
  @IsObject()
  combinations: Record<string, string>;

  @ApiProperty({ description: 'Price in kobo', example: 2500000, minimum: 0 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({
    description: 'Discount price in kobo',
    example: 1990000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_price?: number;

  @ApiProperty({ description: 'Stock quantity', example: 25, minimum: 0 })
  @IsInt()
  @Min(0)
  stock: number;

  @ApiPropertyOptional({
    description: 'Variant image URL',
    example: 'https://example.com/image.jpg',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  image_url?: string | null;

  @ApiPropertyOptional({
    description: 'Cloudinary public ID for variant image',
    example: 'products/abc123',
    nullable: true,
  })
  @IsString()
  @IsOptional()
  image_public_id?: string | null;
}
