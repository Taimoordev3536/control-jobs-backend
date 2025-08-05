import { IsString, IsInt, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { ShiftType } from '../entities/shift.entity';
import { TaskTiming, TaskPeriodicity } from '../entities/task.entity';

export class CreateTaskDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsInt()
  @IsOptional()
  expectedDuration?: number;

  @IsEnum(ShiftType)
  @IsOptional()
  shift?: ShiftType;

  @IsEnum(TaskTiming)
  timing: TaskTiming;

  @IsEnum(TaskPeriodicity)
  periodicity: TaskPeriodicity;

  @IsString()
  @IsOptional()
  periodicityValue?: string;

  @IsBoolean()
  @IsOptional()
  alertTask?: boolean;

  @IsBoolean()
  @IsOptional()
  pendingTask?: boolean;
} 