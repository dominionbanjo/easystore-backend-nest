import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/* ────────────────────────────────────────────────
   RESPONSE DTOs — Installment Module
   Follows the common/dto/response pattern used across the API.
──────────────────────────────────────────────── */

export class InstallmentPresetDto {
  @ApiProperty({
    description: 'Preset ID (used when creating a plan)',
    example: 'fifty-fifty-2wk',
  })
  id: string;

  @ApiProperty({
    description: 'Human-friendly preset name',
    example: '50/50 · 2 weeks',
  })
  name: string;

  @ApiProperty({
    description: 'Number of installments in the preset',
    example: 2,
  })
  count: number;

  @ApiProperty({ description: 'Days between installments', example: 7 })
  interval_days: number;
}

export class InstallmentConfigDto {
  @ApiProperty({
    description: 'Available platform presets',
    type: [InstallmentPresetDto],
  })
  presets: InstallmentPresetDto[];

  @ApiProperty({
    description: 'Minimum order value (kobo) for a plan',
    example: 2000000,
  })
  min_order_kobo: number;

  @ApiProperty({
    description: 'Max concurrently active plans per buyer',
    example: 3,
  })
  max_concurrent_plans: number;

  @ApiProperty({
    description: 'Days a buyer is locked out after a default',
    example: 90,
  })
  default_lockout_days: number;
}

export class InstallmentPaymentListItemDto {
  @ApiProperty({ description: 'Installment payment ID' })
  id: string;

  @ApiProperty({ description: 'Parent plan ID' })
  plan_id: string;

  @ApiProperty({ description: '1-based installment index', example: 1 })
  index: number;

  @ApiProperty({ description: 'Principal amount in kobo', example: 1000000 })
  amount_kobo: number;

  @ApiProperty({
    description: 'Buyer-paid Paystack fee in kobo',
    example: 15385,
  })
  fee_kobo: number;

  @ApiPropertyOptional({
    description: 'Due date',
    type: String,
    format: 'date-time',
  })
  due_date: Date | null;

  @ApiPropertyOptional({
    description: 'Paid timestamp',
    type: String,
    format: 'date-time',
  })
  paid_at: Date | null;

  @ApiPropertyOptional({
    description: 'Paystack payment reference',
    example: 'inst_abc123',
  })
  payment_reference: string | null;

  @ApiPropertyOptional({ description: 'Paystack payment authorization URL' })
  payment_url: string | null;

  @ApiProperty({
    description: 'Status: pending | paid | refunded',
    example: 'paid',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Refund timestamp',
    type: String,
    format: 'date-time',
  })
  refunded_at: Date | null;

  @ApiProperty({
    description: 'Creation timestamp',
    type: String,
    format: 'date-time',
  })
  created_at: Date;
}

export class InstallmentPlanListItemDto {
  @ApiProperty({ description: 'Plan ID' })
  id: string;

  @ApiProperty({ description: 'Order the plan wraps' })
  order_id: string;

  @ApiProperty({ description: 'Buyer (user) ID' })
  buyer_id: string;

  @ApiProperty({ description: 'Vendor (user) ID' })
  vendor_id: string;

  @ApiPropertyOptional({ description: 'Store ID the order belongs to' })
  store_id: string | null;

  @ApiProperty({ description: 'Total plan value in kobo', example: 2000000 })
  total_kobo: number;

  @ApiProperty({ description: 'Amount paid so far in kobo', example: 1000000 })
  paid_kobo: number;

  @ApiProperty({ description: 'Total number of installments', example: 2 })
  installments_total: number;

  @ApiProperty({ description: 'Number of installments paid', example: 1 })
  installments_paid: number;

  @ApiProperty({
    description: 'Payment mode: auto | manual',
    example: 'manual',
  })
  mode: string;

  @ApiProperty({
    description: 'Preset used for the schedule',
    example: 'fifty-fifty-2wk',
  })
  preset_id: string;

  @ApiPropertyOptional({
    description: 'Next installment due date',
    type: String,
    format: 'date-time',
  })
  next_due_date: Date | null;

  @ApiProperty({
    description:
      'Plan status: active | completed | defaulted | canceled | refunding',
    example: 'active',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Deposit expiry (unpaid deposits auto-cancel)',
    type: String,
    format: 'date-time',
  })
  deposit_expires_at: Date | null;

  @ApiPropertyOptional({
    description: 'When the plan was defaulted',
    type: String,
    format: 'date-time',
  })
  defaulted_at: Date | null;

  @ApiPropertyOptional({
    description: 'When the plan was canceled',
    type: String,
    format: 'date-time',
  })
  canceled_at: Date | null;

  @ApiPropertyOptional({
    description: 'When the plan was completed',
    type: String,
    format: 'date-time',
  })
  completed_at: Date | null;

  @ApiPropertyOptional({ description: 'Admin note (overrides)' })
  admin_note: string | null;

  @ApiProperty({
    description: 'Creation timestamp',
    type: String,
    format: 'date-time',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    type: String,
    format: 'date-time',
  })
  updated_at: Date;
}

export class InstallmentPlanDetailDto extends InstallmentPlanListItemDto {
  @ApiProperty({
    description: 'Installment payments for this plan',
    type: [InstallmentPaymentListItemDto],
  })
  payments: InstallmentPaymentListItemDto[];
}

export class InstallmentPaymentInitResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    description: 'Paystack payment authorization URL',
    example: 'https://checkout.paystack.com/abc123',
  })
  payment_url: string;

  @ApiProperty({
    description: 'Paystack payment reference',
    example: 'inst_abc123',
  })
  reference: string;
}

export class CreateInstallmentOrderResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ description: 'Created pending order ID' })
  order_id: string;

  @ApiProperty({
    description: 'Order grand total in kobo (plan total)',
    example: 2000000,
  })
  total_kobo: number;
}

export class InstallmentSimpleResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiPropertyOptional({
    description: 'Plan ID (when created)',
    example: 'uuid',
  })
  id?: string;

  @ApiPropertyOptional({ description: 'Refund results per paid installment' })
  refunds?: Array<{ index: number; ok: boolean; reference: string }>;
}
