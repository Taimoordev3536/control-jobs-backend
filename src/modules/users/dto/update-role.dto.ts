import { IsNumber } from 'class-validator';

export class UpdateRoleDto {
  @IsNumber()
  role: number;
}