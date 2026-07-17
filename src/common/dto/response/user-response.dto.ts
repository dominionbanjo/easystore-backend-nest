import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddressResponseDto {
  @ApiProperty({ description: 'Address ID' })
  id: string;

  @ApiProperty({ description: 'Street address' })
  street: string;

  @ApiProperty({ description: 'City' })
  city: string;

  @ApiProperty({ description: 'State' })
  state: string;

  @ApiProperty({ description: 'Country' })
  country: string;

  @ApiPropertyOptional({ description: 'Postal code' })
  postal_code: string | null;
}

export class UserListItemDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'First name' })
  first_name: string;

  @ApiProperty({ description: 'Last name' })
  last_name: string;

  @ApiProperty({ description: 'Username' })
  username: string;

  @ApiProperty({ description: 'Email address' })
  email: string;

  @ApiProperty({ description: 'Account type (user/vendor/admin)' })
  account_type: string;

  @ApiProperty({ description: 'Account status' })
  account_status: string;

  @ApiProperty({ description: 'Whether email is verified' })
  email_verified: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;
}

export class VendorListItemDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'First name' })
  first_name: string;

  @ApiProperty({ description: 'Last name' })
  last_name: string;

  @ApiProperty({ description: 'Email' })
  email: string;

  @ApiProperty({ description: 'Account status' })
  account_status: string;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;

  @ApiPropertyOptional({ description: 'Store ID' })
  store_id: string | null;

  @ApiPropertyOptional({ description: 'Store name' })
  store_name: string | null;

  @ApiPropertyOptional({ description: 'Store logo URL' })
  logo: string | null;

  @ApiPropertyOptional({ description: 'Store status' })
  store_status: string | null;
}
