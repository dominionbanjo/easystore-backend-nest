import { IsUUID, IsString, Length } from 'class-validator';

export class ConfirmDeliveryDto {
  @IsUUID()
  order_id: string;

  @IsString()
  @Length(4, 10)
  code: string;
}
