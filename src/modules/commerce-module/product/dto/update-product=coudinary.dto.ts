import { Type } from 'class-transformer';
import {
  IsUUID,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsInt,
  IsArray,
  ValidateNested,
  IsObject,
} from 'class-validator';
import { CloudinaryAssetDto } from './create-product-cloudinary.dto';

export class UpdateProductCloudinaryDto {
  @IsUUID()
  @IsOptional()
  category_id?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

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

  // @IsString()
  // @IsOptional()
  // country?: string;

  // @IsString()
  // @IsOptional()
  // state?: string;

  // @IsString()
  // @IsOptional()
  // city?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  shipping_cost?: number;

  @IsString()
  @IsOptional()
  shipping_note?: string;

  @IsString()
  @IsOptional()
  returns_note?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  /* ───────── CLOUDINARY ───────── */
  @IsOptional()
  @ValidateNested()
  @Type(() => CloudinaryAssetDto)
  image?: CloudinaryAssetDto | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloudinaryAssetDto)
  gallery?: CloudinaryAssetDto[] | null;

  /* ───────── DETAILS ───────── */
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
}
