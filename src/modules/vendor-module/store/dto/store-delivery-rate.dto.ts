import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SetProductDeliveryRateDto {
  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  location: string;

  @IsNumber()
  fee: number;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
