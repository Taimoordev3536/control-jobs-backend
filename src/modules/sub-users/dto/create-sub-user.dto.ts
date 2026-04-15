import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { SubUserPermission } from '../../auth/enums/sub-user-permission.enum';

export class CreateSubUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsEnum(SubUserPermission)
  permission: SubUserPermission;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
