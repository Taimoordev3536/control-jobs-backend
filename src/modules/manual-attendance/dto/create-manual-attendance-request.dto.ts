import { IsString, IsOptional, IsEnum, IsDateString, IsUUID } from 'class-validator';
import { ManualAttendanceRequestType } from '../enums/request-type.enum';

export class CreateManualAttendanceRequestDto {
  @IsString()
  jobId: string;

  @IsOptional()
  @IsString()
  workerId?: string;

  @IsOptional()
  @IsString()
  workCenterId?: string;

  @IsEnum(ManualAttendanceRequestType)
  requestType: ManualAttendanceRequestType;

  @IsDateString()
  requestedDate: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  requestedCheckIn?: string; // ISO timestamp

  @IsOptional()
  @IsString()
  requestedCheckOut?: string; // ISO timestamp

  @IsOptional()
  @IsUUID()
  existingWorkSessionId?: string; // For EDIT_EXISTING type

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  workerNotes?: string;
}
