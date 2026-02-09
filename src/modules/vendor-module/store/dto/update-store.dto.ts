import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsArray,
  IsEmail,
  IsObject,
} from 'class-validator';

class UpdateStoreBaseDto {
  @IsOptional()
  @IsString()
  store_name?: string;

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
}

export class UpdateStoreDto extends PartialType(UpdateStoreBaseDto) {}
