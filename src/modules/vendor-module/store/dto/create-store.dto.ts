import {
  IsString,
  IsUUID,
  IsOptional,
  IsEmail,
  IsInt,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoreDto {
  @ApiProperty({
    description: 'Vendor user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  user_id: string;

  @ApiProperty({ description: 'Store name', example: 'My Online Store' })
  @IsString()
  store_name: string;

  @ApiProperty({
    description: 'Store email address',
    example: 'store@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Store category',
    example: 'Electronics',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({
    description: 'Store description',
    example: 'We sell the best electronics',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+2348012345678',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  phone_number?: string | null;

  @ApiPropertyOptional({
    description: 'Website URL',
    example: 'https://mystore.com',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  website?: string | null;

  @ApiPropertyOptional({
    description: 'Street address',
    example: '123 Main Street',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  address_street?: string | null;

  @ApiPropertyOptional({
    description: 'City',
    example: 'Lagos',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  address_city?: string | null;

  @ApiPropertyOptional({ description: 'State', example: 'LA', nullable: true })
  @IsOptional()
  @IsString()
  address_state?: string | null;

  @ApiPropertyOptional({
    description: 'Country',
    example: 'NG',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  address_country?: string | null;

  @ApiPropertyOptional({
    description: 'Postal code',
    example: '100001',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  address_postal_code?: string | null;

  @ApiPropertyOptional({ description: 'Setup stage', example: 1 })
  @IsOptional()
  @IsInt()
  setup_stage?: number;

  @ApiPropertyOptional({
    description:
      'Escrow protection: buyer funds are held safely until delivery is confirmed, then released to the vendor.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  escrow_enabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Installments: let buyers pay for products in parts (deposit + scheduled payments). The vendor ships only when fully paid.',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  installments_enabled?: boolean;
}
