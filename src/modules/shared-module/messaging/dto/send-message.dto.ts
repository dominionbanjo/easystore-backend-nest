import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  IsUrl,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ description: 'Message content', example: 'Hi, is this still available?', minLength: 1, maxLength: 2000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  @ApiPropertyOptional({ description: 'Related product ID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  product_id?: string;

  @ApiPropertyOptional({ description: 'Product name', example: 'Wireless Headphones', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  product_name?: string;

  @ApiPropertyOptional({ description: 'Product image URL', example: 'https://example.com/product.jpg' })
  @IsOptional()
  @IsUrl()
  product_image?: string;

  @ApiPropertyOptional({ description: 'Product slug', example: 'wireless-headphones', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  product_slug?: string;

  @ApiPropertyOptional({ description: 'Local/client-side message ID for deduplication', example: 'msg_abc123', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  local_id?: string;
}
