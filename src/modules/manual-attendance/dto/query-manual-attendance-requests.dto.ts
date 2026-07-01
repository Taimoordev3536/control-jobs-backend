import { IsOptional, IsEnum, IsUUID, IsDateString } from 'class-validator';
import { ManualAttendanceRequestStatus } from '../enums/request-status.enum';

export class QueryManualAttendanceRequestsDto {
  @IsOptional()
  @IsEnum(ManualAttendanceRequestStatus)
  status?: ManualAttendanceRequestStatus;

  @IsOptional()
  @IsUUID()
  jobId?: string;

  @IsOptional()
  @IsUUID()
  workerId?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
