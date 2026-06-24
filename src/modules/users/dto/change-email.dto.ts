import { IsEmail, IsString } from 'class-validator';

export class ChangeEmailDto {
  @IsString()
  currentPassword: string;

  @IsEmail()
  newEmail: string;
}
