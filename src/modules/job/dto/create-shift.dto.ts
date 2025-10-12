import { IsString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { ShiftType, ScheduleType, Season } from '../entities/shift.entity';

export class CreateShiftDto {
  @IsString()
  day: string;

  @IsEnum(ShiftType)
  @IsOptional()
  shiftType?: ShiftType;

  @IsInt()
  totalHours: number;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsEnum(ScheduleType)
  scheduleType: ScheduleType;

  @IsEnum(Season)
  @IsOptional()
  season?: Season;
} 