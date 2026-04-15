import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class ProductSearchDto {
  /* ───────────────── SEARCH ───────────────── */

  @IsOptional()
  @IsString()
  q: string;

  @IsOptional()
  @IsString()
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc' | 'date_desc';

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
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isOutOfStock?: boolean;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  onSale?: boolean;

  @IsOptional()
  @IsString()
  status?: string;

  /* ───────────────── DYNAMIC FILTERS (PIPED CSV → MAP) ───────────────── */
  // Handles unified dynamic filters, e.g. "?filter=Color:Red|Size:M,L"
  // Transforms it into a Record<string, string[]> for dynamic JSONB querying.
  @IsOptional()
  @Transform(({ value }) => {
    if (!value || typeof value !== 'string') return undefined;
    const filtersObj: Record<string, string[]> = {};
    const parts = value.split('|');
    for (const part of parts) {
      const [key, vals] = part.split(':');
      if (key && vals) {
        filtersObj[key] = vals
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      }
    }
    return filtersObj;
  })
  filter?: Record<string, string[]>;
}
