import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  IsArray,
  IsObject,
  IsUUID,
  IsBoolean,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CloudinaryAssetDto } from './create-product.dto';

export class DraftProductOptionDto {
  @ApiPropertyOptional({ description: 'Option name', example: 'Size' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Option values',
    example: ['Small', 'Medium', 'Large'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  values?: string[];
}

export class DraftProductVariantDto {
  @ApiPropertyOptional({
    description: 'Variant ID (for updates)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({ description: 'SKU code', example: 'HD-WHITE-M' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({
    description: 'Variant barcode/UPC',
    example: '8901234567891',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @ApiPropertyOptional({
    description: 'Variant combination map (editable during draft)',
    example: { Color: 'White', Size: 'M' },
  })
  @IsOptional()
  @IsObject()
  combinations?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Price in kobo',
    example: 2500000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: 'Discount price in kobo',
    example: 1990000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_price?: number;

  @ApiPropertyOptional({
    description: 'Stock quantity',
    example: 25,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({
    description: 'Variant image URL',
    example: 'https://example.com/image.jpg',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  image_url?: string | null;

  @ApiPropertyOptional({
    description: 'Cloudinary public ID for variant image',
    example: 'products/abc123',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  image_public_id?: string | null;
}

/**
 * Backend-controlled product draft payload.
 *
 * Every field is optional so vendors can save incomplete products (e.g. only
 * a name, or only uploaded images) and continue later on any device.
 */
export class SaveProductDraftDto {
  @ApiPropertyOptional({
    description:
      'Existing draft product id (when resuming a previously saved draft)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiPropertyOptional({
    description: 'Product category ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Product name',
    example: 'Wireless Bluetooth Headphones',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Barcode / UPC / EAN',
    example: '8901234567890',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string;

  @ApiPropertyOptional({
    description: 'Product description',
    example: 'High-quality wireless headphones with noise cancellation',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Price in kobo',
    example: 2500000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    description: 'Discount price in kobo',
    example: 1990000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount_price?: number;

  @ApiPropertyOptional({
    description: 'Stock quantity',
    example: 50,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({
    description: 'Shipping information',
    example: 'Ships within 3-5 business days',
  })
  @IsOptional()
  @IsString()
  shipping_note?: string;

  @ApiPropertyOptional({
    description: 'Returns policy',
    example: '30-day return policy',
  })
  @IsOptional()
  @IsString()
  returns_note?: string;

  @ApiPropertyOptional({
    description:
      'Allow buyers to pay for this product with an installment plan',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  installment_enabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Subset of platform presets the vendor offers — buyers pick within this list',
    example: ['fifty-fifty-2wk', 'quarters-4mo'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  installment_presets?: string[];

  @ApiPropertyOptional({
    description: 'Product tags',
    example: ['electronics', 'audio', 'wireless'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Product main image (Cloudinary)',
    type: CloudinaryAssetDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CloudinaryAssetDto)
  image?: CloudinaryAssetDto | null;

  @ApiPropertyOptional({
    description: 'Product gallery images (Cloudinary)',
    type: [CloudinaryAssetDto],
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
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @ApiPropertyOptional({
    description: 'Product specifications',
    example: { weight: '250g', color: 'Black' },
  })
  @IsOptional()
  @IsObject()
  specs?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Product options (draft-tolerant)',
    type: [DraftProductOptionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftProductOptionDto)
  options?: DraftProductOptionDto[];

  @ApiPropertyOptional({
    description: 'Product variants (draft-tolerant)',
    type: [DraftProductVariantDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftProductVariantDto)
  variants?: DraftProductVariantDto[];
}
