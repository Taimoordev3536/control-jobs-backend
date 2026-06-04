import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAdminMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
