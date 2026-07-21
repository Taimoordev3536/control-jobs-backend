import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
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

  // resolveWorkSessionPublicId accepts a UUID or a numeric id; the records list
  // supplies `publicId || id`, so @IsUUID blocked valid edit requests.
  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  existingWorkSessionId?: string; // For EDIT_EXISTING type

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  workerNotes?: string;
}
