import { Type } from 'class-transformer';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  Min,
  MaxLength,
  IsInt,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CloudinaryAssetDto } from './create-product.dto';
import { ProductOptionDto, ProductVariantDto } from './product-variants.dto';

export class UpdateProductDto {
  @ApiPropertyOptional({
    description: 'Product category ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  @IsOptional()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Product name',
    example: 'Wireless Bluetooth Headphones',
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Barcode / UPC / EAN',
    example: '8901234567890',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  barcode?: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'Updated description with new features',
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
    description:
      'Allow buyers to pay for this product with an installment plan',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  installment_enabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Subset of platform presets the vendor offers — buyers pick within this list',
    example: ['fifty-fifty-2wk', 'quarters-4mo'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  installment_presets?: string[];

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
    description: 'Product tags',
    example: ['electronics', 'audio', 'wireless'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Product main image (Cloudinary)',
    type: CloudinaryAssetDto,
    nullable: true,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CloudinaryAssetDto)
  image?: CloudinaryAssetDto | null;

  @ApiPropertyOptional({
    description: 'Product gallery images (Cloudinary)',
    type: [CloudinaryAssetDto],
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloudinaryAssetDto)
  gallery?: CloudinaryAssetDto[] | null;

  @ApiPropertyOptional({
    description: 'Product highlights',
    example: ['Noise cancelling', '30hr battery'],
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
    description: 'Product options',
    type: [ProductOptionDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionDto)
  @IsOptional()
  options?: ProductOptionDto[];

  @ApiPropertyOptional({
    description: 'Product variants',
    type: [ProductVariantDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  @IsOptional()
  variants?: ProductVariantDto[];
}
