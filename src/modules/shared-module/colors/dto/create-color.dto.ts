import { IsString, IsHexColor, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateColorDto {
  @ApiProperty({
    description: 'Color name',
    example: 'Crimson Red',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiProperty({ description: 'Hex color code', example: '#DC143C' })
  @IsHexColor()
  hex: string;
}
