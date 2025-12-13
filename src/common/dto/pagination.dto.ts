import { IsOptional, IsInt, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Min(1)
  @IsInt()
  page?: number = 1;

  @IsOptional()
  @Min(1)
  @IsInt()
  limit?: number = 20;
}
