import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateGroupConversationDto {
  @IsUUID()
  employerPublicId: string;

  @IsOptional()
  @IsUUID()
  adminPublicId?: string;

  @IsOptional()
  @IsUUID()
  clientPublicId?: string;

  @IsOptional()
  @IsUUID()
  workerPublicId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
