import {
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateCartDto {
  @IsUUID()
  product_id: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  size?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string | null;
}
