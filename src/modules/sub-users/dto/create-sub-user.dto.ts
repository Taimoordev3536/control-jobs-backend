import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SubUserPermission } from '../../auth/enums/sub-user-permission.enum';

export class CreateSubUserDto {
  @IsEnum(SubUserPermission)
  permission: SubUserPermission;

  // Identity is entered by the invitee when they accept the link, so these are
  // optional at invite time.
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
