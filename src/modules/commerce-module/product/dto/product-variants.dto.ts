import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  IsArray,
  IsObject,
  IsUUID,
  Min,
  IsNotEmpty,
} from 'class-validator';

export class ProductOptionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  values: string[];
}

export class ProductVariantDto {
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsObject()
  combinations: Record<string, string>;

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

  @IsString()
  @IsOptional()
  image_url?: string | null;

  @IsString()
  @IsOptional()
  image_public_id?: string | null;
}
