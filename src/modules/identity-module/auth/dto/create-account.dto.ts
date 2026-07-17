import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsIn,
  IsStrongPassword,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty({ description: 'First name', example: 'John', minLength: 2 })
  @IsString()
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Doe', minLength: 2 })
  @IsString()
  last_name: string;

  @ApiProperty({ description: 'Email address', example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Strong password (min 8 chars, 1 upper, 1 lower, 1 number, 1 symbol)', example: 'SecurePass123!' })
  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phone_number?: string;

  @ApiProperty({ description: 'Account type', example: 'vendor', enum: ['user', 'vendor'] })
  @IsIn(['user', 'vendor'])
  account_type: 'user' | 'vendor';

  @ApiPropertyOptional({ description: 'Store name (required if account_type is vendor)', example: 'My Online Store' })
  @IsOptional()
  @IsString()
  store_name?: string;

  @ApiPropertyOptional({ description: 'Store description', example: 'We sell quality products' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Referral code', example: 'REF123' })
  @IsOptional()
  @IsString()
  referral_code?: string;

  @ApiPropertyOptional({ description: 'Current sales channel', example: 'instagram', enum: ['whatsapp', 'instagram', 'facebook', 'tiktok', 'other'] })
  @IsOptional()
  @IsIn(['whatsapp', 'instagram', 'facebook', 'tiktok', 'other'])
  current_sales_channel?: string;

  @ApiProperty({ description: 'Agree to terms and conditions', example: true })
  @IsBoolean()
  agree_to_terms: boolean;
}
