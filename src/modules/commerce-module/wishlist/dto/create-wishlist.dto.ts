import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class CreateWishlistDto {
  @ApiProperty({ description: 'Product ID to add to wishlist', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  product_id: string;

  @ApiPropertyOptional({ description: 'Product variant ID', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  variant_id?: string;
}
