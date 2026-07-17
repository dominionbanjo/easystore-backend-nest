import { IsUUID, IsString, Length, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmDeliveryDto {
  @ApiProperty({ description: 'Order ID to confirm delivery for', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  order_id: string;

  @ApiPropertyOptional({ description: 'Delivery confirmation code', example: 'ABCD', minLength: 4, maxLength: 10 })
  @IsOptional()
  @IsString()
  @Length(4, 10)
  code?: string;
}
