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
import { ProductOptionDto, ProductVariantDto } from './product-variants.dto';

export class CloudinaryAssetDto {
  @IsString()
  url: string;

  @IsString()
  public_id: string;
}

export class CreateProductCloudinaryDto {
  /* ───────────── IDs ───────────── */
  @IsUUID()
  category_id: string;

  /* ───────────── BASIC INFO ───────────── */
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  /* ───────────── PRICING ───────────── */
  @IsNumber()
  @Min(0)
  @IsOptional()
  price?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_price?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  stock?: number;

  /* ───────────── LOCATION (FIXED) ───────────── */
  // @IsString()
  // country: string;

  // @IsString()
  // @IsOptional()
  // state?: string;

  // @IsString()
  // city: string;

  /* ───────────── SHIPPING ───────────── */

  @IsString()
  @IsOptional()
  shipping_note?: string;

  @IsString()
  @IsOptional()
  returns_note?: string;

  /* ───────────── TAGS ───────────── */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  /* ───────────── MEDIA (CLOUDINARY) ───────────── */
  @IsOptional()
  @ValidateNested()
  @Type(() => CloudinaryAssetDto)
  image?: CloudinaryAssetDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloudinaryAssetDto)
  gallery?: CloudinaryAssetDto[];

  /* ───────────── DETAILS ───────────── */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  highlights?: string[];

  @IsObject()
  @IsOptional()
  specs?: Record<string, string>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductOptionDto)
  @IsOptional()
  options?: ProductOptionDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  @IsOptional()
  variants?: ProductVariantDto[];

  // delivery_rates?: SetProductDeliveryRateDto[];
}
