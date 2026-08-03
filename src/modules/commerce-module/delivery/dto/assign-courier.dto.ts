import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignCourierDto {
  @ApiProperty({
    description: 'Courier user ID to assign',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  courier_id: string;
}
