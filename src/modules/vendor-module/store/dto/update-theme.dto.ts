import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ThemeConfigDto {
  @IsOptional()
  @IsString()
  header_style?: string;

  @IsOptional()
  @IsString()
  primary_color?: string;

  @IsOptional()
  @IsString()
  font_family?: string;

  @IsOptional()
  @IsString()
  layout_style?: string;

  @IsOptional()
  @IsBoolean()
  dark_mode_default?: boolean;
}

export class UpdateThemeDto {
  @IsNotEmpty()
  @IsString()
  template_id: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ThemeConfigDto)
  custom_config?: ThemeConfigDto;
}
