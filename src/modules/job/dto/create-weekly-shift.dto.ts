import { IsEnum, IsString, IsBoolean, IsInt, IsOptional } from 'class-validator';
import { Weekday } from '../entities/shift.entity';

export class CreateWeeklyShiftDto {
  @IsEnum(Weekday)
  startWeekday: Weekday;

  @IsEnum(Weekday)
  endWeekday: Weekday;

  @IsString()
  baseStartTime: string;

  @IsString()
  baseEndTime: string;

  @IsBoolean()
  @IsOptional()
  isContinuous?: boolean;

  @IsInt()
  @IsOptional()
  totalHours?: number;
}
