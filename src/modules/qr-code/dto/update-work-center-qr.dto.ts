import { IsEnum, IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { QrCodeType } from '../entities/qr-code.entity';

export class UpdateWorkCenterQrDto {
  @IsEnum(QrCodeType)
  selectedType: QrCodeType;

  @IsBoolean()
  active: boolean;
}

export class WorkCenterQrResponseDto {
  staticQr: {
    id: string;
    token: string;
    qrImage: string;
    type: QrCodeType;
    isSelected: boolean;
    isActive: boolean;
    expiresAt: Date | null;
  } | null;

  dynamicQr: {
    id: string;
    token: string;
    qrImage: string;
    type: QrCodeType;
    isSelected: boolean;
    isActive: boolean;
    expiresAt: Date | null;
    lastRefreshedAt: Date | null;
  } | null;
}
