import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { ParticipantType } from '../enums/chat.enums';

export class CreateDirectConversationDto {
  @IsEnum(ParticipantType)
  targetType: ParticipantType;

  @IsOptional()
  @IsUUID()
  targetEntityPublicId?: string;
}
