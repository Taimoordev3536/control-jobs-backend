import { IsUUID } from 'class-validator';

export class CreateGroupConversationDto {
  @IsUUID()
  employerPublicId: string;

  @IsUUID()
  clientPublicId: string;

  @IsUUID()
  workerPublicId: string;
}
