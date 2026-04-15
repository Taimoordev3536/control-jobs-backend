import { IsBoolean, IsOptional, IsInt, Min } from 'class-validator';

export class UpdateManualAttendancePermissionDto {
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  workerCanRequest?: boolean;

  @IsOptional()
  @IsBoolean()
  employerCanCreate?: boolean;

  @IsOptional()
  @IsBoolean()
  clientCanCreate?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRetroactiveDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRequestsPerWorkerMonth?: number;

  @IsOptional()
  @IsBoolean()
  requireReason?: boolean;
}
