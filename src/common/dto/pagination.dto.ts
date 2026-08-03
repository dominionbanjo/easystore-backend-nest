import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Search query string',
    example: 'search term',
  })
  @IsOptional()
  @Type(() => String)
  q?: string;

  @ApiPropertyOptional({
    description: 'Filter by state/status',
    example: 'active',
  })
  @IsOptional()
  @Type(() => String)
  state?: string;

  @ApiPropertyOptional({
    description: 'Sort order (e.g. created_at:DESC)',
    example: 'created_at:DESC',
  })
  @IsOptional()
  @Type(() => String)
  sort?: string;

  @ApiPropertyOptional({
    description: 'Rank local (state) items first instead of filtering to them',
    example: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  local?: boolean;
}
