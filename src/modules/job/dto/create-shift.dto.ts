import { IsString, IsEnum, IsInt, IsOptional } from 'class-validator';
import { ShiftType, Season } from '../entities/shift.entity';
import { ScheduleType } from '../entities/schedule-type.enum';

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