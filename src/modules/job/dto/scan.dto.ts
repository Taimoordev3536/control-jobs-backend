import { IsNumber, IsOptional, IsString, IsIn, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export class RecordScanDto {
  @IsString()
  jobId: string;

  @IsString()
  @IsIn(['check-in', 'check-out', 'break-start', 'break-end'])
  scanType: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  userTimezone?: string;

  @IsOptional()
  @IsString()
  @IsIn(['web', 'ip', 'gps', 'qrcode'])
  signingMethod?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  qrToken?: string;

  // Callers send either the UUID publicId or the numeric id; resolveWorkCenterPublicId
  // accepts both, so normalize to string rather than reject a number outright.
  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  workCenterId?: string;

  // Identity-verification selfie as a base64 data URL (data:image/jpeg;base64,...)
  @IsOptional()
  @IsString()
  selfie?: string;

  // Worker chose to continue check-in without location (browser blocked/denied it).
  @IsOptional()
  @IsBoolean()
  locationUnavailable?: boolean;
}


