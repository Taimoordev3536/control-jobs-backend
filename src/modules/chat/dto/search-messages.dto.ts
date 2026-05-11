import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SearchMessagesDto {
  @IsString()
  @MinLength(2)
  q: string;

  @IsOptional()
  @IsUUID()
  conversationPublicId?: string;
}
