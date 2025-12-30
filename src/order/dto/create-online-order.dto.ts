import { IsArray, ValidateNested, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';
import { CartItemDto } from './cart-item.dto';

export class CreateOnlineOrderDto {
  @IsEmail()
  email: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  order_items: CartItemDto[];
}
