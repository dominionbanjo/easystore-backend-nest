import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendOtpDto {
  @ApiProperty({ description: 'Email address to resend OTP to', example: 'john@example.com' })
  @IsEmail()
  email: string;
}
