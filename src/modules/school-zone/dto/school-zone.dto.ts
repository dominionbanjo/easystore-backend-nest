import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSchoolZoneDto {
  @ApiProperty({ description: 'School / zone name', example: 'Unilag Campus Market' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description: 'Zone subdomain (e.g. unilag) -> unilag.eazystore.com.ng',
    example: 'unilag',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Subdomain may only contain lowercase letters, numbers and dashes',
  })
  @MinLength(2)
  @MaxLength(50)
  subdomain: string;

  @ApiPropertyOptional({ description: 'Short tagline shown on the zone page' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  tagline?: string;

  @ApiPropertyOptional({ description: 'Long description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'State of the school', example: 'Lagos' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  state: string;

  @ApiProperty({
    description: 'School delivery location (campus / area)',
    example: 'University of Lagos, Akoka',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  location: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @ApiPropertyOptional({ description: 'Contact phone' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contact_phone?: string;

  @ApiPropertyOptional({ description: 'Logo URL (uploaded via cloudinary)' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ description: 'Cover image URL (uploaded via cloudinary)' })
  @IsOptional()
  @IsString()
  cover_image?: string;
}

export class UpdateSchoolZoneDto {
  @ApiPropertyOptional({ description: 'School / zone name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Short tagline shown on the zone page' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  tagline?: string;

  @ApiPropertyOptional({ description: 'Long description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'State of the school' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ description: 'School delivery location' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @ApiPropertyOptional({ description: 'Contact email' })
  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @ApiPropertyOptional({ description: 'Contact phone' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  contact_phone?: string;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({ description: 'Cover image URL' })
  @IsOptional()
  @IsString()
  cover_image?: string;
}

export class ApplyToZoneDto {
  @ApiProperty({ description: 'Department of the student vendor', example: 'Computer Science' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  department: string;

  @ApiProperty({ description: 'Course of study', example: 'Software Engineering' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  course: string;

  @ApiProperty({ description: 'Student ID number', example: '170123456' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  student_id_number: string;

  @ApiProperty({
    description: 'School ID card image URL (uploaded via cloudinary)',
  })
  @IsString()
  @IsNotEmpty()
  school_id_image: string;

  @ApiProperty({
    description: 'Delivery fee (naira) for the school location',
    example: 1500,
  })
  @IsNotEmpty()
  delivery_fee: number;
}

export class ZoneMemberDecisionDto {
  @ApiProperty({ description: 'approve or reject' })
  @IsString()
  @IsNotEmpty()
  decision: 'approve' | 'reject';

  @ApiPropertyOptional({ description: 'Rejection reason (required when rejecting)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ZoneApprovalDecisionDto {
  @ApiProperty({ description: 'approve or reject' })
  @IsString()
  @IsNotEmpty()
  decision: 'approve' | 'reject';

  @ApiPropertyOptional({ description: 'Rejection reason (required when rejecting)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
