import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import type { BroadcastTarget } from '../entities/broadcast.entity';

export class CreateBroadcastDto {
  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsEnum(['all', 'vendors', 'users', 'specific'])
  target: BroadcastTarget;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];

  @IsOptional()
  @IsDateString()
  scheduled_at?: string;

  @IsOptional()
  @IsBoolean()
  is_recurring?: boolean;

  @IsOptional()
  @IsEnum(['daily', 'weekly', 'monthly'])
  recurrence_type?: 'daily' | 'weekly' | 'monthly';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recurrence_days?: string[];

  @IsOptional()
  @IsString()
  recurrence_time?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recurrence_day_of_month?: string[];
}
