import { IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateProductDto } from './create-product.dto';

class CloudinaryAssetDto {
  url: string;
  public_id: string;
}

export class CreateProductCloudinaryDto extends CreateProductDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CloudinaryAssetDto)
  image?: CloudinaryAssetDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloudinaryAssetDto)
  gallery?: CloudinaryAssetDto[];
}
