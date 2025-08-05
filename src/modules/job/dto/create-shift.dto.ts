import { IsString, IsEnum, IsInt } from 'class-validator';
import { ShiftType, ScheduleType, Season } from '../entities/shift.entity';

export class CreateShiftDto {
  @IsString()
  day: string;

  @IsEnum(ShiftType)
  shiftType: ShiftType;

  @IsInt()
  totalHours: number;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsEnum(ScheduleType)
  scheduleType: ScheduleType;

  @IsEnum(Season)
  season: Season;
} 