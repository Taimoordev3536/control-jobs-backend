import { IsNumber, IsOptional, IsString, IsIn } from 'class-validator';

export class RecordScanDto {
  @IsNumber()
  jobId: number;

  @IsString()
  @IsIn(['check-in', 'check-out', 'break-start', 'break-end'])
  scanType: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GenerateQrCodeDto {
  @IsNumber()
  jobId: number;
}
