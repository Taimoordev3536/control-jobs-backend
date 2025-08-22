// import { IsString, IsInt, IsEnum, IsOptional, IsBoolean } from 'class-validator';
// import { ShiftType } from '../entities/shift.entity';
// import { TaskTiming, TaskPeriodicity } from '../entities/task.entity';

// export class CreateTaskDto {
//   @IsString()
//   name: string;

//   @IsString()
//   @IsOptional()
//   note?: string;

//   @IsInt()
//   @IsOptional()
//   expectedDuration?: number;

//   @IsEnum(ShiftType)
//   @IsOptional()
//   shift?: ShiftType;

//   @IsEnum(TaskTiming)
//   timing: TaskTiming;

//   @IsEnum(TaskPeriodicity)
//   periodicity: TaskPeriodicity;

//   @IsString()
//   @IsOptional()
//   periodicityValue?: string;

//   @IsBoolean()
//   @IsOptional()
//   alertTask?: boolean;

//   @IsBoolean()
//   @IsOptional()
//   pendingTask?: boolean;
// } 



// src/dto/create-task.dto.ts
import { IsString, IsInt, IsEnum, IsArray, IsOptional, ValidateIf, IsDateString, IsBoolean,IsNotEmpty } from 'class-validator';
import { ShiftType } from '../entities/shift.entity'; // Adjust import
import { TaskTiming } from '../entities/task.entity'; // Adjust import
import { TaskPeriodicity } from '../entities/task.entity'

export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
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

  // New optional fields with conditions
  @ValidateIf(o => o.periodicity === TaskPeriodicity.ONCE || o.periodicity === TaskPeriodicity.PERSONALIZED)
  @IsDateString()
  @IsOptional()
  periodicityDate?: string;

  @ValidateIf(o => o.periodicity === TaskPeriodicity.WEEKLY)
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  weeklyDays?: string[];

  @ValidateIf(o => o.periodicity === TaskPeriodicity.MONTHLY)
  @IsInt()
  @IsOptional()
  monthlyDay?: number;
}