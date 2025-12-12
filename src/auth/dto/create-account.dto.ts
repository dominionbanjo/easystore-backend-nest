import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsIn,
  IsStrongPassword,
} from 'class-validator';

export class CreateAccountDto {
  @IsString()
  first_name: string;

  @IsString()
  last_name: string;

  @IsEmail()
  email: string;

  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password: string;

  @IsOptional()
  @IsString()
  phone_number?: string;

  @IsIn(['user', 'vendor'])
  account_type: 'user' | 'vendor';

  @IsOptional()
  @IsString()
  store_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  referral_code?: string;

  @IsOptional()
  @IsIn(['whatsapp', 'instagram', 'facebook', 'tiktok', 'other'])
  current_sales_channel?: string;

  @IsBoolean()
  agree_to_terms: boolean;
}
