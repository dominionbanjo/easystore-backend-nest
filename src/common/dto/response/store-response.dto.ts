import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StoreListItemDto {
  @ApiProperty({ description: 'Store ID' })
  id: string;

  @ApiProperty({ description: 'Store name' })
  store_name: string;

  @ApiProperty({ description: 'Store slug' })
  slug: string;

  @ApiPropertyOptional({ description: 'Store description' })
  description: string | null;

  @ApiPropertyOptional({ description: 'Store logo URL' })
  logo: string | null;

  @ApiProperty({ description: 'Average rating' })
  rating_average: number;

  @ApiProperty({ description: 'Total products count' })
  total_products: number;

  @ApiProperty({ description: 'Store status' })
  status: string;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;
}

export class StoreAdminListItemDto {
  @ApiProperty({ description: 'Store ID' })
  id: string;

  @ApiProperty({ description: 'Store name' })
  store_name: string;

  @ApiProperty({ description: 'Store slug' })
  slug: string;

  @ApiProperty({ description: 'Store category' })
  category: string;

  @ApiProperty({ description: 'Total revenue' })
  total_revenue: number;

  @ApiProperty({ description: 'Total orders' })
  total_orders: number;

  @ApiProperty({ description: 'Total products' })
  total_products: number;

  @ApiProperty({ description: 'Average rating' })
  rating_average: number;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;
}
