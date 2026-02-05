import {
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class CartItemDto {
  @IsNotEmpty()
  @IsUUID()
  product_id: string;

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
