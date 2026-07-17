import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class VariantResponseDto {
  @ApiProperty({ description: 'Variant ID' })
  id: string;

  @ApiProperty({ description: 'Variant price in Naira (kobo ÷ 100)' })
  price: number;

  @ApiPropertyOptional({ description: 'Discounted price' })
  discount_price: number | null;

  @ApiProperty({ description: 'Stock quantity' })
  stock: number;

  @ApiProperty({ description: 'Variant combination key-value pairs' })
  combinations: Record<string, string>;

  @ApiPropertyOptional({ description: 'Variant image URL' })
  image_url: string | null;
}

export class ProductCardResponseDto {
  @ApiProperty({ description: 'Product ID' })
  id: string;

  @ApiProperty({ description: 'Product name' })
  name: string;

  @ApiProperty({ description: 'URL-friendly slug' })
  slug: string;

  @ApiProperty({ description: 'Price in Naira' })
  price: number;

  @ApiPropertyOptional({ description: 'Product image URL' })
  image: string | null;

  @ApiProperty({ description: 'Average rating (0-5)' })
  rating_average: number;

  @ApiProperty({ description: 'Stock quantity' })
  stock: number;

  @ApiPropertyOptional({ description: 'Discounted price in Naira' })
  discount_price: number | null;

  @ApiProperty({ description: 'Whether product is on sale' })
  on_sale: boolean;

  @ApiProperty({ description: 'Whether product is featured' })
  featured: boolean;

  @ApiPropertyOptional({ description: 'Category name' })
  category: string | null;

  @ApiProperty({ description: 'Product variant options', type: [Object] })
  options: { name: string; values: string[] }[];

  @ApiProperty({ description: 'Product variants', type: [VariantResponseDto] })
  variants: VariantResponseDto[];

  @ApiPropertyOptional({ description: 'Store name' })
  store_name: string | null;

  @ApiPropertyOptional({ description: 'Store slug' })
  store_slug: string | null;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;

  @ApiProperty({ description: 'Whether product is in user wishlist' })
  is_in_wishlist: boolean;
}
