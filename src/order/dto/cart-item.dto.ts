import { IsUUID, IsInt, Min, IsOptional, IsString } from 'class-validator';

export class CartItemDto {
  @IsUUID()
  product_id: string;

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
