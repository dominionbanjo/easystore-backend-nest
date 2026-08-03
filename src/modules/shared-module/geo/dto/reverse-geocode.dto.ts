import { ApiProperty } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';

export class ReverseGeocodeDto {
  @ApiProperty({ description: 'Latitude of the location', example: 6.5244 })
  @IsNumber()
  @IsLatitude()
  lat: number;

  @ApiProperty({ description: 'Longitude of the location', example: 3.3792 })
  @IsNumber()
  @IsLongitude()
  lon: number;
}
