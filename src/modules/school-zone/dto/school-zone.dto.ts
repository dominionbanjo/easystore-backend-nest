import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { SCHOOL_ZONE_STATUSES } from '../entities/school-zone.entity';
import { SCHOOL_ZONE_MEMBER_STATUSES } from '../entities/school-zone-member.entity';

export class CreateSchoolZoneDto {
  @ApiProperty({
    description: 'School / zone name',
    example: 'Unilag Campus Market',
  })
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

  @ApiPropertyOptional({
    description: 'Cover image URL (uploaded via cloudinary)',
  })
  @IsOptional()
  @IsString()
  cover_image?: string;

  /* ── School rep verification (same info vendors submit to join) ── */
  @ApiPropertyOptional({
    description: 'Department of the school rep',
    example: 'Computer Science',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  department?: string;

  @ApiPropertyOptional({
    description: 'Course of study of the school rep',
    example: 'Software Engineering',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  course?: string;

  @ApiPropertyOptional({
    description: 'Student ID number of the school rep',
    example: '170123456',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  student_id_number?: string;

  @ApiPropertyOptional({
    description:
      'School ID card image URL of the school rep (uploaded via cloudinary)',
  })
  @IsOptional()
  @IsString()
  school_id_image?: string;

  @ApiPropertyOptional({
    description: 'Delivery fee (naira) for the school location',
    example: 1500,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  delivery_fee?: number;
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
  @ApiProperty({
    description: 'Department of the student vendor',
    example: 'Computer Science',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  department: string;

  @ApiPropertyOptional({
    description: 'Course of study',
    example: 'Software Engineering',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  course?: string;

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

  @ApiPropertyOptional({
    description: 'Rejection reason (required when rejecting)',
  })
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

  @ApiPropertyOptional({
    description: 'Rejection reason (required when rejecting)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SchoolZoneListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by zone status (admin view)',
    enum: SCHOOL_ZONE_STATUSES,
  })
  @IsOptional()
  @IsEnum(SCHOOL_ZONE_STATUSES)
  status?: (typeof SCHOOL_ZONE_STATUSES)[number];
}

export class ZoneMembersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by membership status',
    enum: SCHOOL_ZONE_MEMBER_STATUSES,
  })
  @IsOptional()
  @IsEnum(SCHOOL_ZONE_MEMBER_STATUSES)
  status?: (typeof SCHOOL_ZONE_MEMBER_STATUSES)[number];
}
