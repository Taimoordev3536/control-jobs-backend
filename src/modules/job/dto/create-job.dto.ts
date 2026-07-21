import { IsString, IsDateString, IsArray, IsOptional, IsNotEmpty, ValidateNested, IsEnum } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { CreateShiftDto } from './create-shift.dto';
import { ScheduleType } from '../entities/shift.entity';
import { CreateSeasonPeriodDto } from './create-season-period.dto';
import { CreateSeasonalScheduleDto } from './create-seasonal-schedule.dto';
import { CreateSigningMethodDto } from './create-signing-method.dto';
import { CreateAlertDto } from './create-alert.dto';
import { CreateTaskDto } from './create-task.dto';
import { CreateSurveyDto } from '../../survey/dto/create-survey.dto';
import { JobStatus } from '../enums/job-status.enum';

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  jobName: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  // Deprecated single workCenterId removed in favor of workCenterIds array
  // Use workCenterIds to pass multiple work center IDs from frontend.
  // Coerced to strings: the UI mixes UUID publicIds and numeric ids here.
  @IsArray()
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => (v == null ? v : String(v))) : value))
  @IsString({ each: true })
  workCenterIds?: string[];

  @IsArray()
  @Transform(({ value }) => (Array.isArray(value) ? value.map((v) => (v == null ? v : String(v))) : value))
  @IsString({ each: true })
  workerIds: string[];

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  // note is used as observation; keep single field

  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;

  @IsEnum(ScheduleType)
  @IsOptional()
  scheduleType?: ScheduleType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShiftDto)
  @IsOptional()
  shifts?: CreateShiftDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSeasonalScheduleDto)
  @IsOptional()
  seasonalSchedules?: CreateSeasonalScheduleDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSeasonPeriodDto)
  @IsOptional()
  seasonPeriods?: CreateSeasonPeriodDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSigningMethodDto)
  signingMethods: CreateSigningMethodDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAlertDto)
  alerts: CreateAlertDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  @IsOptional()
  tasks?: CreateTaskDto[];

  @ValidateNested()
  @Type(() => CreateSurveyDto)
  @IsOptional()
  survey?: CreateSurveyDto;

  // New separate surveys for customer and worker
  @ValidateNested()
  @Type(() => CreateSurveyDto)
  @IsOptional()
  customerSurvey?: CreateSurveyDto;

  @ValidateNested()
  @Type(() => CreateSurveyDto)
  @IsOptional()
  workerSurvey?: CreateSurveyDto;
} 