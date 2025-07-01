import { IsBoolean, IsNumber } from 'class-validator';

export class AssignClientUserDto {
  @IsNumber()
  clientId: number;

  @IsNumber()
  userId: number;

  @IsBoolean()
  isDefault: boolean;
}
