// src/product-category/dto/create-product-category.dto.ts
import { IsString, IsOptional, IsUUID, Length } from 'class-validator';

export class CreateProductCategoryDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  slug?: string;

  /**
   * Parent category ID (optional)
   * If provided → this becomes a sub-category
   */
  @IsOptional()
  @IsUUID()
  parent_id?: string;
}
