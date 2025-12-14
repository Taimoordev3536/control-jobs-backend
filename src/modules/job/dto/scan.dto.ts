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
}

import { QrCodeType, QrCodeOwnerType } from '../entities/qr-code.entity';

export class GenerateQrCodeDto {
  @IsOptional()
  @IsNumber()
  jobId?: number;

  @IsOptional()
  @IsNumber()
  ownerId?: number;

  @IsOptional()
  @IsString()
  ownerType?: QrCodeOwnerType;

  @IsOptional()
  @IsString()
  type?: QrCodeType;
}
