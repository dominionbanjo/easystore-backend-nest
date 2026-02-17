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
} from 'class-validator';

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
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_price?: number;

  @IsInt()
  @Min(0)
  stock: number;

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
  @IsString({ each: true })
  @IsOptional()
  colors?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sizes?: string[];

  @IsArray()
  @IsOptional()
  variants?: {
    size: string;
    price: number;
    stock: number;
    discount_price?: number;
  }[];

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

  @IsNumber()
  @Min(0)
  @IsOptional()
  shipping_cost?: number;
}
