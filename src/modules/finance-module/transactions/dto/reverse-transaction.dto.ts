import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReverseTransactionDto {
  @ApiProperty({
    description: 'Reason for reversing the transaction',
    example: 'Duplicate payment',
  })
  @IsString()
  reason: string;
}
