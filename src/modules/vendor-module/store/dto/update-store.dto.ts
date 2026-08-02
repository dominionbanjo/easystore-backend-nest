import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsArray,
  IsEmail,
  IsObject,
  IsNumber,
  IsBoolean,
} from 'class-validator';

class UpdateStoreBaseDto {
  @ApiPropertyOptional({ description: 'Store name', example: 'My Online Store' })
  @IsOptional()
  @IsString()
  store_name?: string;

  @ApiPropertyOptional({ description: 'Store subdomain', example: 'mystore', nullable: true })
  @IsOptional()
  @IsString()
  subdomain?: string | null;

  @ApiPropertyOptional({ description: 'Store description', example: 'We sell the best products' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Store category', example: 'Fashion' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Category IDs', example: ['cat-1', 'cat-2'] })
  @IsOptional()
  @IsArray()
  category_ids?: string[];

  @ApiPropertyOptional({ description: 'Store email', example: 'store@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiPropertyOptional({ description: 'Website URL', example: 'https://mystore.com' })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiPropertyOptional({ description: 'Social media links', example: { instagram: '@myStore', facebook: 'MyStore' } })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  })
  @IsObject()
  social_links?: Record<string, string>;

  @ApiPropertyOptional({ description: 'Street address', example: '123 Main Street', nullable: true })
  @IsOptional()
  @IsString()
  address_street?: string | null;

  @ApiPropertyOptional({ description: 'City', example: 'Lagos', nullable: true })
  @IsOptional()
  @IsString()
  address_city?: string | null;

  @ApiPropertyOptional({ description: 'State', example: 'LA', nullable: true })
  @IsOptional()
  @IsString()
  address_state?: string | null;

  @ApiPropertyOptional({ description: 'Country', example: 'NG', nullable: true })
  @IsOptional()
  @IsString()
  address_country?: string | null;

  @ApiPropertyOptional({ description: 'Postal code', example: '100001', nullable: true })
  @IsOptional()
  @IsString()
  address_postal_code?: string | null;

  @ApiPropertyOptional({ description: 'Cover image URL', example: 'https://example.com/cover.jpg', nullable: true })
  @IsOptional()
  @IsString()
  cover_image?: string | null;

  @ApiPropertyOptional({ description: 'Cloudinary public ID for cover image', example: 'stores/cover_abc123', nullable: true })
  @IsOptional()
  @IsString()
  cover_image_public_id?: string | null;

  @ApiPropertyOptional({ description: 'Logo URL', example: 'https://example.com/logo.jpg', nullable: true })
  @IsOptional()
  @IsString()
  logo?: string | null;

  @ApiPropertyOptional({ description: 'Cloudinary public ID for logo', example: 'stores/logo_abc123', nullable: true })
  @IsOptional()
  @IsString()
  logo_public_id?: string | null;

  @ApiPropertyOptional({ description: 'Setup stage', example: 3 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  setup_stage?: number;

  @ApiPropertyOptional({ description: 'Escrow payments enabled', example: false })
  @IsOptional()
  @Transform(({ obj }) => {
    const raw = (obj as { escrow_enabled?: unknown } | undefined)
      ?.escrow_enabled;
    if (raw === undefined) return undefined;
    return typeof raw === 'string' ? raw === 'true' : raw === true;
  })
  @IsBoolean()
  escrow_enabled?: boolean;
}

export class UpdateStoreDto extends PartialType(UpdateStoreBaseDto) {}
