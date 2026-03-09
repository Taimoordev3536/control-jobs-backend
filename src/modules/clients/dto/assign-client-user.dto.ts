import { IsBoolean, IsString } from 'class-validator';

export class AssignClientUserDto {
  @IsString()
  clientId: string;

  @IsString()
  userId: string;

  @IsBoolean()
  isDefault: boolean;
}
