import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SetProductDeliveryRateDto {
  @ApiProperty({ description: 'Delivery state', example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ description: 'Delivery location', example: 'Ikeja' })
  @IsString()
  @IsNotEmpty()
  location: string;

  @ApiProperty({ description: 'Delivery fee in kobo', example: 250000 })
  @IsNumber()
  fee: number;

  @ApiPropertyOptional({ description: 'Estimated delivery duration', example: '2-3 business days' })
  @IsString()
  @IsOptional()
  duration?: string;

  @ApiPropertyOptional({ description: 'Additional notes', example: 'Weekend delivery available' })
  @IsString()
  @IsOptional()
  notes?: string;
}
