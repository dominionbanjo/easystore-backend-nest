import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class BuyerSummaryDto {
  @ApiProperty({ description: 'Buyer ID' })
  id: string;

  @ApiProperty({ description: 'First name' })
  first_name: string;

  @ApiProperty({ description: 'Last name' })
  last_name: string;

  @ApiProperty({ description: 'Email address' })
  email: string;
}

class VendorSummaryDto {
  @ApiProperty({ description: 'Vendor ID' })
  id: string;

  @ApiProperty({ description: 'First name' })
  first_name: string;

  @ApiProperty({ description: 'Last name' })
  last_name: string;

  @ApiProperty({ description: 'Email address' })
  email: string;
}

class DeliverySummaryDto {
  @ApiProperty({ description: 'Delivery ID' })
  id: string;

  @ApiProperty({ description: 'Delivery status' })
  delivery_status: string;

  @ApiPropertyOptional({ description: 'Tracking number' })
  tracking_number: string | null;

  @ApiPropertyOptional({ description: 'Estimated delivery date' })
  estimated_delivery: Date | null;

  @ApiPropertyOptional({ description: 'Actual delivery date' })
  delivered_at: Date | null;

  @ApiPropertyOptional({ description: 'Delivery address' })
  address: string | null;

  @ApiPropertyOptional({ description: 'City' })
  city: string | null;

  @ApiPropertyOptional({ description: 'State' })
  state: string | null;
}

export class OrderListItemDto {
  @ApiProperty({ description: 'Order ID' })
  id: string;

  @ApiProperty({ description: 'Buyer ID' })
  buyer_id: string;

  @ApiProperty({ description: 'Vendor ID' })
  vendor_id: string;

  @ApiProperty({ description: 'Order status' })
  status: string;

  @ApiProperty({ description: 'Payment status' })
  payment_status: string;

  @ApiProperty({ description: 'Total amount in kobo' })
  total: number;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;

  @ApiPropertyOptional({ description: 'Buyer details', type: BuyerSummaryDto })
  buyer?: BuyerSummaryDto;

  @ApiPropertyOptional({
    description: 'Vendor details',
    type: VendorSummaryDto,
  })
  vendor?: VendorSummaryDto;

  @ApiPropertyOptional({
    description: 'Delivery summary',
    type: DeliverySummaryDto,
  })
  delivery?: DeliverySummaryDto;
}
