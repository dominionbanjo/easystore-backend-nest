import { IsString, IsHexColor, Length } from 'class-validator';

export class CreateColorDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsHexColor()
  hex: string;
}
