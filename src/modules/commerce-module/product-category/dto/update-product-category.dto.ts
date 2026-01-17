// src/product-category/dto/update-product-category.dto.ts
import { IsString, IsOptional, IsUUID, Length } from 'class-validator';

export class UpdateProductCategoryDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  slug?: string;

  /**
   * Change parent category
   * - UUID → move under another category
   * - null → make it a root category
   */
  @IsOptional()
  @IsUUID()
  parent_id?: string | null;
}
