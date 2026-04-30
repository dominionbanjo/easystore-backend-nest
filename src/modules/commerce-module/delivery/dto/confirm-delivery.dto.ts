import { IsUUID, IsString, Length, IsOptional } from 'class-validator';

export class ConfirmDeliveryDto {
  @IsUUID()
  order_id: string;

  @IsOptional()
  @IsString()
  @Length(4, 10)
  code?: string;
}
