import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { BroadcastTarget } from '../entities/broadcast.entity';

export class CreateBroadcastDto {
  @ApiProperty({
    description: 'Broadcast subject',
    example: 'Important Announcement',
  })
  @IsString()
  subject: string;

  @ApiProperty({
    description: 'Broadcast body/content',
    example: 'We are excited to announce new features...',
  })
  @IsString()
  body: string;

  @ApiProperty({
    enum: ['all', 'vendors', 'users', 'specific'],
    description: 'Target audience',
    example: 'all',
  })
  @IsEnum(['all', 'vendors', 'users', 'specific'])
  target: BroadcastTarget;

  @ApiPropertyOptional({
    description: 'Specific recipient emails (when target is specific)',
    example: ['user1@example.com', 'user2@example.com'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];

  @ApiPropertyOptional({
    description: 'Scheduled date/time',
    example: '2025-01-15T10:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a recurring broadcast',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  is_recurring?: boolean;

  @ApiPropertyOptional({
    enum: ['daily', 'weekly', 'monthly'],
    description: 'Recurrence frequency',
    example: 'weekly',
  })
  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  recurrence_type?: 'daily' | 'weekly' | 'monthly';

  @ApiPropertyOptional({
    description: 'Days for recurrence (e.g. MON, WED, FRI)',
    example: ['MON', 'WED', 'FRI'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recurrence_days?: string[];

  @ApiPropertyOptional({
    description: 'Time of day for recurrence (HH:mm)',
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  recurrence_time?: string;

  @ApiPropertyOptional({
    description: 'Days of month for monthly recurrence',
    example: ['1', '15'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recurrence_day_of_month?: string[];
}
