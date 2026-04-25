import { IsUUID } from 'class-validator';

export class StartConversationDto {
  @IsUUID()
  recipient_id: string;
}
