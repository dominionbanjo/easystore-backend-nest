import { IsString, IsUUID, IsIn, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateInstallmentPlanDto {
  @ApiProperty({
    description: 'ID of the pending order to wrap in a plan',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  order_id: string;

  @ApiProperty({
    description: 'Platform preset defining the schedule',
    example: 'fifty-fifty-2wk',
    enum: [
      'fifty-fifty-2wk',
      'thirds-3wk',
      'quarters-4wk',
      'half-2mo',
      'thirds-3mo',
      'quarters-4mo',
    ],
  })
  @IsString()
  preset_id: string;

  @ApiProperty({
    description:
      "auto = save the buyer's card and charge each installment automatically; manual = buyer pays each installment via a fresh payment link",
    example: 'manual',
    enum: ['auto', 'manual'],
  })
  @IsIn(['auto', 'manual'])
  mode: 'auto' | 'manual';
}

export class PayInstallmentDto {
  @ApiPropertyOptional({ description: 'Optional note attached to the payment' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CancelInstallmentDto {
  @ApiPropertyOptional({ description: 'Optional reason for cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ListInstallmentsDto {
  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  page = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 10,
    default: 10,
  })
  @IsOptional()
  limit = 10;

  @ApiPropertyOptional({
    description:
      'Filter by plan status: active | completed | defaulted | canceled | refunding',
    example: 'active',
  })
  @IsOptional()
  @IsString()
  status?: string;
}

export class AdminInstallmentActionDto {
  @ApiProperty({
    description: 'Reason for the admin override (audit trail)',
    example: 'Buyer paid via bank transfer',
  })
  @IsString()
  admin_note: string;
}
