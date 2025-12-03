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

  @IsOptional()
  @IsString()
  userTimezone?: string;
}

import { QrCodeType, QrCodeOwnerType } from '../entities/qr-code.entity';

export class GenerateQrCodeDto {
  @IsOptional()
  @IsNumber()
  jobId?: number;

  @IsNumber()
  ownerId: number;

  @IsString()
  ownerType: QrCodeOwnerType;

  @IsOptional()
  @IsString()
  type?: QrCodeType;
}
