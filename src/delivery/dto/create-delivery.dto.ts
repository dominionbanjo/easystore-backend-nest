import { IsUUID, IsOptional, IsString } from 'class-validator';

export class CreateDeliveryDto {
  @IsUUID()
  order_id: string;

  @IsUUID()
  buyer_id: string;

  @IsUUID()
  vendor_id: string;

  @IsOptional()
  @IsUUID()
  courier_id?: string | null;

  @IsOptional()
  @IsString()
  address?: string | null;

  @IsOptional()
  @IsString()
  city?: string | null;

  @IsOptional()
  @IsString()
  state?: string | null;

  @IsOptional()
  @IsString()
  country?: string | null;

  @IsOptional()
  @IsString()
  postal_code?: string | null;

  @IsOptional()
  @IsString()
  tracking_number?: string | null;
}
