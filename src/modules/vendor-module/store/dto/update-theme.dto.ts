import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ThemeConfigDto {
  @ApiPropertyOptional({ description: 'Header style', example: 'modern' })
  @IsOptional()
  @IsString()
  header_style?: string;

  @ApiPropertyOptional({ description: 'Primary color hex code', example: '#4F46E5' })
  @IsOptional()
  @IsString()
  primary_color?: string;

  @ApiPropertyOptional({ description: 'Font family', example: 'Inter' })
  @IsOptional()
  @IsString()
  font_family?: string;

  @ApiPropertyOptional({ description: 'Layout style', example: 'grid' })
  @IsOptional()
  @IsString()
  layout_style?: string;

  @ApiPropertyOptional({ description: 'Default dark mode', example: false })
  @IsOptional()
  @IsBoolean()
  dark_mode_default?: boolean;
}

export class UpdateThemeDto {
  @ApiProperty({ description: 'Template ID', example: 'template_modern' })
  @IsNotEmpty()
  @IsString()
  template_id: string;

  @ApiPropertyOptional({ description: 'Custom theme configuration', type: ThemeConfigDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ThemeConfigDto)
  custom_config?: ThemeConfigDto;
}
