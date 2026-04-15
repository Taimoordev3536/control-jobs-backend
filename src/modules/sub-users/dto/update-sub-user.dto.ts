import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { SubUserPermission } from '../../auth/enums/sub-user-permission.enum';

export class UpdateSubUserDto {
  @IsOptional()
  @IsEnum(SubUserPermission)
  permission?: SubUserPermission;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
