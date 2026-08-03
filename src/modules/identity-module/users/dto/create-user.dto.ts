import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ description: 'First name', example: 'John', minLength: 2 })
  @IsString()
  @MinLength(2)
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Doe', minLength: 2 })
  @IsString()
  @MinLength(2)
  last_name: string;

  @ApiProperty({ description: 'Email address', example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Password (min 6 characters)',
    example: 'securePass123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiPropertyOptional({
    description: 'Phone number',
    example: '+2348012345678',
  })
  @IsOptional()
  @IsString()
  phone_number?: string;
}
