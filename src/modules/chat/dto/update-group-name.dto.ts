import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateGroupNameDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;
}
