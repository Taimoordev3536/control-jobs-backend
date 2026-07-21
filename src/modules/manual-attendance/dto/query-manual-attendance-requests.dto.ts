import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { ManualAttendanceRequestStatus } from '../enums/request-status.enum';

export class QueryManualAttendanceRequestsDto {
  @IsOptional()
  @IsEnum(ManualAttendanceRequestStatus)
  status?: ManualAttendanceRequestStatus;

  // These come from route params, which are a publicId when the record has one
  // and the numeric id otherwise. The service resolvers accept both, so @IsUUID
  // rejected ids the code could handle — leaving the tab permanently empty.
  @IsOptional()
  @IsString()
  jobId?: string;

  @IsOptional()
  @IsString()
  workerId?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
