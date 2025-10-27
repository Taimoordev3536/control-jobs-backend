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
import { IsString, IsInt, IsEnum, IsArray, IsOptional, ValidateIf, IsDateString, IsBoolean, IsNotEmpty, ArrayNotEmpty, ArrayUnique, Min } from 'class-validator';
import { ShiftType } from '../entities/shift.entity';
import { TaskTiming, TaskPeriodicity } from '../entities/task.entity';

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

  @IsBoolean()
  @IsOptional()
  alertTask?: boolean;

  @IsBoolean()
  @IsOptional()
  pendingTask?: boolean;

  // Optional per-task work center (select one of the job's work centers)
  @IsInt()
  @IsOptional()
  workCenterId?: number;

  // ---------- Common periodicity fields ----------
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  interval?: number;

  // ---------- Once ----------
  @ValidateIf(o => o.periodicity === TaskPeriodicity.ONCE)
  @IsDateString()
  onceDate?: string;

  // ---------- Weekly ----------
  @ValidateIf(o => o.periodicity === TaskPeriodicity.WEEKLY)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  weeklyDays?: number[];

  // ---------- Monthly ----------
  @ValidateIf(o => o.periodicity === TaskPeriodicity.MONTHLY)
  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  monthlyDays?: number[];

  @ValidateIf(o => o.periodicity === TaskPeriodicity.MONTHLY)
  @IsArray()
  @IsOptional()
  @IsInt({ each: true })
  monthlyWeekdays?: number[];

  // New: pick the first occurrence of a weekday in the month (0=Sun..6=Sat)
  @ValidateIf(o => o.periodicity === TaskPeriodicity.MONTHLY)
  @IsOptional()
  @IsInt()
  monthlyStartWeekday?: number;

  // New: pick the last occurrence of a weekday in the month (0=Sun..6=Sat)
  @ValidateIf(o => o.periodicity === TaskPeriodicity.MONTHLY)
  @IsOptional()
  @IsInt()
  monthlyEndWeekday?: number;

  // ---------- Yearly ----------
  @ValidateIf(o => o.periodicity === TaskPeriodicity.YEARLY)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  yearlyMonths?: number[];

  @ValidateIf(o => o.periodicity === TaskPeriodicity.YEARLY)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  yearlyDays?: number[];
}