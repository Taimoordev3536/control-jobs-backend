import { IsString, IsDateString, IsInt, IsArray, IsOptional, IsNotEmpty, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateShiftDto } from './create-shift.dto';
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

  @IsInt()
  clientId: number;

  @IsInt()
  @Type(() => Number)
  workCenterId: number;

  @IsArray()
  @IsInt({ each: true })
  workerIds: number[];

  @IsString()
  @IsOptional()
  note?: string;

  @IsEnum(JobStatus)
  @IsOptional()
  status?: JobStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateShiftDto)
  shifts: CreateShiftDto[];

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
} 