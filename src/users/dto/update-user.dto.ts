import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsPhoneNumber,
  Allow,
  IsObject,
} from 'class-validator';

export class AddressDto {
  @IsOptional()
  @IsString()
  @Allow()
  street?: string;

  @IsOptional()
  @IsString()
  @Allow()
  city?: string;

  @IsOptional()
  @IsString()
  @Allow()
  state?: string;

  @IsOptional()
  @IsString()
  @Allow()
  country?: string;

  @IsOptional()
  @IsString()
  @Allow()
  postal_code?: string;
}

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsPhoneNumber('NG')
  phone_number?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    if (!value) return undefined;

    // multipart/form-data → string
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }

    // already an object
    return value;
  })
  address?: Record<string, string>;
}
