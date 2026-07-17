import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GoogleLoginDto {
  @ApiProperty({ description: 'Google OAuth ID token', example: 'eyJhbGciOiJSUzI1NiIs...' })
  @IsString()
  token: string;
}
