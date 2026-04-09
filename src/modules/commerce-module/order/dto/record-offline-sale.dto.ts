import { IsString, IsOptional, IsArray, ValidateNested, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

class OfflineSaleItemDto {
  @IsString()
  product_id: string;

  @IsOptional()
  @IsString()
  variant_id?: string;

  @IsNumber()
  @Min(1)
  quantity: number;
}

export class RecordVendorOfflineSaleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfflineSaleItemDto)
  items: OfflineSaleItemDto[];

  @IsOptional()
  @IsString()
  customer_name?: string;

  @IsOptional()
  @IsString()
  customer_email?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
