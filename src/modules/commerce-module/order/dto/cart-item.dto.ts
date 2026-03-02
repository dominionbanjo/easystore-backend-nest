import {
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateIf,
} from 'class-validator';

export class CartItemDto {
  @IsNotEmpty()
  @IsUUID()
  product_id: string;

  @IsOptional()
  @ValidateIf((o) => o.variant_id !== null)
  @IsUUID()
  variant_id?: string | null;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  size?: string | null;

  @IsOptional()
  @IsString()
  color?: string | null;
}
