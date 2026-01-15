import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsBoolean,
  IsArray,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ProductSearchDto {
  /* ───────────────── SEARCH ───────────────── */

  @IsString()
  q: string;

  /* ───────────────── PAGINATION ───────────────── */

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  /* ───────────────── PRICE ───────────────── */

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  /* ───────────────── LOCATION ───────────────── */

  @IsOptional()
  @IsString()
  country?: string; // NG

  @IsOptional()
  @IsString()
  state?: string; // LA

  @IsOptional()
  @IsString()
  city?: string; // Lagos

  /* ───────────────── FILTERS ───────────────── */

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rating?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  inStock?: boolean;

  /* ───────────────── ARRAYS (CSV → ARRAY) ───────────────── */

  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : value
          ?.split(',')
          .map((v: string) => v.trim())
          .filter(Boolean),
  )
  @IsArray()
  @IsString({ each: true })
  colors?: string[];

  @IsOptional()
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value
      : value
          ?.split(',')
          .map((v: string) => v.trim())
          .filter(Boolean),
  )
  @IsArray()
  @IsString({ each: true })
  sizes?: string[];
}
