import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateWorkCenterIpDto {
  @IsBoolean()
  active: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^(\d{1,3}\.){3}\d{1,3}$/, { message: 'ipAddress must be a valid IPv4 address' })
  ipAddress?: string;
}
