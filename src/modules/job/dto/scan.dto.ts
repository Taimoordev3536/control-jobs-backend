import { IsNumber, IsOptional, IsString, IsIn } from 'class-validator';

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

  @IsOptional()
  @IsString()
  workCenterId?: string;
}


