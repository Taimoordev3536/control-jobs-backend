import { IsEnum, IsString, IsInt, IsOptional } from 'class-validator';
import { AlertType } from '../entities/alert.entity';

export class CreateAlertDto {
  @IsEnum(AlertType)
  alertType: AlertType;

  @IsString()
  @IsOptional()
  triggerTime?: string;

  @IsInt()
  @IsOptional()
  minDuration?: number;
} 