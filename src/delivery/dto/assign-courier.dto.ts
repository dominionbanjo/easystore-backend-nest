import { IsUUID } from 'class-validator';

export class AssignCourierDto {
  @IsUUID()
  courier_id: string;
}
