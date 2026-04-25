import {
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  IsUrl,
  MinLength,
} from 'class-validator';

export class SendMessageDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;

  // ── Optional product attachment ──────────────

  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  product_name?: string;

  @IsOptional()
  @IsUrl()
  product_image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  product_slug?: string;
  @IsOptional()
  @IsString()
  @MaxLength(100)
  local_id?: string;
}
