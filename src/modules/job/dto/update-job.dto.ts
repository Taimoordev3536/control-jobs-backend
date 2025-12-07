import { IsString, IsDateString, IsInt, IsArray, IsOptional, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateShiftDto } from './create-shift.dto';
import { ScheduleType } from '../entities/shift.entity';
import { CreateSeasonPeriodDto } from './create-season-period.dto';
import { CreateSeasonalScheduleDto } from './create-seasonal-schedule.dto';
import { CreateSigningMethodDto } from './create-signing-method.dto';
import { CreateAlertDto } from './create-alert.dto';
import { CreateTaskDto } from './create-task.dto';
import { CreateSurveyDto } from '../../survey/dto/create-survey.dto';
import { JobStatus } from '../enums/job-status.enum';

export class UpdateJobDto {
  @IsString()
  @IsOptional()
  jobName?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsInt()
  @IsOptional()
  @Type(() => Number)
  clientId?: number;

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  @Type(() => Number)
  workCenterIds?: number[];

  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  workerIds?: number[];

  @IsString()
  @IsOptional()
  note?: string;

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
  @IsOptional()
  signingMethods?: CreateSigningMethodDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAlertDto)
  @IsOptional()
  alerts?: CreateAlertDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  @IsOptional()
  tasks?: CreateTaskDto[];

  @ValidateNested()
  @Type(() => CreateSurveyDto)
  @IsOptional()
  customerSurvey?: CreateSurveyDto;

  @ValidateNested()
  @Type(() => CreateSurveyDto)
  @IsOptional()
  workerSurvey?: CreateSurveyDto;
}
