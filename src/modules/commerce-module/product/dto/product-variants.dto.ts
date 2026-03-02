import {
  IsString,
  IsNumber,
  IsOptional,
  IsInt,
  IsArray,
  IsObject,
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
}
