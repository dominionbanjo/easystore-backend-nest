import {
  IsString,
  IsOptional,
  IsNumber,
  IsInt,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ProductSearchDto {
  @ApiPropertyOptional({ description: 'Search query', example: 'wireless headphones' })
  @IsOptional()
  @IsString()
  q: string;

  @ApiPropertyOptional({ description: 'Sort order', example: 'relevance', enum: ['relevance', 'price_asc', 'price_desc', 'rating_desc', 'date_desc'] })
  @IsOptional()
  @IsString()
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc' | 'date_desc';

  @ApiPropertyOptional({ description: 'Page number', example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Minimum price in kobo', example: 100000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum price in kobo', example: 5000000, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Country filter', example: 'NG' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ description: 'State filter', example: 'LA' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ description: 'Local-first mode: rank matches from this state first instead of filtering (requires state)', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  local?: boolean;

  @ApiPropertyOptional({ description: 'City filter', example: 'Lagos' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Minimum rating', example: 4, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rating?: number;

  @ApiPropertyOptional({ description: 'Filter by in-stock products', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  inStock?: boolean;

  @ApiPropertyOptional({ description: 'Filter by out-of-stock products', example: false })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isOutOfStock?: boolean;

  @ApiPropertyOptional({ description: 'Filter by products on sale', example: true })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  onSale?: boolean;

  @ApiPropertyOptional({ description: 'Filter by product status', example: 'active' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Dynamic filters (e.g. Color:Red|Size:M,L)', example: 'Color:Red|Size:M,L' })
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
