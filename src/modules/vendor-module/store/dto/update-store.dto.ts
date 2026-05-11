import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsArray,
  IsEmail,
  IsObject,
  IsNumber,
} from 'class-validator';

class UpdateStoreBaseDto {
  @IsOptional()
  @IsString()
  store_name?: string;

  @IsOptional()
  @IsString()
  subdomain?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  category_ids?: string[];

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsOptional()
  @IsString()
  website?: string;

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

  /* ADDRESS (COLUMN-BASED) */
  @IsOptional()
  @IsString()
  address_street?: string | null;

  @IsOptional()
  @IsString()
  address_city?: string | null;

  @IsOptional()
  @IsString()
  address_state?: string | null;

  @IsOptional()
  @IsString()
  address_country?: string | null;

  @IsOptional()
  @IsString()
  address_postal_code?: string | null;

  @IsOptional()
  @IsString()
  cover_image?: string | null;

  @IsOptional()
  @IsString()
  cover_image_public_id?: string | null;

  @IsOptional()
  @IsString()
  logo?: string | null;

  @IsOptional()
  @IsString()
  logo_public_id?: string | null;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  setup_stage?: number;
}

export class UpdateStoreDto extends PartialType(UpdateStoreBaseDto) {}
