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
import { SetProductDeliveryRateDto } from '../../../vendor-module/store/dto/store-delivery-rate.dto';

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
  price: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount_price?: number;

  @IsInt()
  @Min(0)
  stock: number;

  /* ───────────── LOCATION (FIXED) ───────────── */
  // @IsString()
  // country: string;

  // @IsString()
  // @IsOptional()
  // state?: string;

  // @IsString()
  // city: string;

  /* ───────────── SHIPPING ───────────── */
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
  @IsString({ each: true })
  @IsOptional()
  colors?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sizes?: string[];

  // delivery_rates?: SetProductDeliveryRateDto[];
}
