// src/product/dto/create-product.dto.ts
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

export class CreateProductDto {
  /* ───────────────── IDs ───────────────── */

  @IsUUID()
  category_id: string;

  /* ───────────────── BASIC INFO ───────────────── */

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  /* ───────────────── PRICING ───────────────── */

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

  /* ───────────────── TAGS ───────────────── */

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  /* ───────────────── MEDIA ───────────────── */

  // @IsObject()
  // @IsOptional()
  // image?: {
  //   url: string;
  //   public_id: string;
  // };

  // @IsArray()
  // @IsOptional()
  // gallery?: {
  //   url: string;
  //   public_id: string;
  // }[];

  /* ───────────────── DETAILS ───────────────── */

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

  /* ───────────────── SHIPPING ───────────────── */

  @IsString()
  @IsOptional()
  shipping_note?: string;

  @IsString()
  @IsOptional()
  returns_note?: string;

  @IsString()
  @IsOptional()
  location?: string;
}
