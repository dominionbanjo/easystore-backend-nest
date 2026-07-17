import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsPhoneNumber,
  Allow,
  IsObject,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AddressDto {
  @ApiPropertyOptional({ description: 'Street address', example: '123 Main Street' })
  @IsOptional()
  @IsString()
  @Allow()
  street?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Lagos' })
  @IsOptional()
  @IsString()
  @Allow()
  city?: string;

  @ApiPropertyOptional({ description: 'State', example: 'LA' })
  @IsOptional()
  @IsString()
  @Allow()
  state?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'NG' })
  @IsOptional()
  @IsString()
  @Allow()
  country?: string;

  @ApiPropertyOptional({ description: 'Postal code', example: '100001' })
  @IsOptional()
  @IsString()
  @Allow()
  postal_code?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'First name', example: 'John' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ description: 'Phone number (NG)', example: '+2348012345678' })
  @IsOptional()
  @IsPhoneNumber('NG')
  phone_number?: string;

  @ApiPropertyOptional({ description: 'Username', example: 'johndoe' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: 'Address object', example: { street: '123 Main St', city: 'Lagos', state: 'LA', country: 'NG', postal_code: '100001' } })
  @IsOptional()
  @IsObject()
  @Transform(({ value }) => {
    if (!value) return undefined;

    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    }

    return value;
  })
  address?: Record<string, string>;
}
