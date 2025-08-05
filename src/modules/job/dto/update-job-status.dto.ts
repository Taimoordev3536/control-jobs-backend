import { IsEnum, IsOptional, IsString } from 'class-validator';
import { JobStatus } from '../enums/job-status.enum';

export class UpdateJobStatusDto {
  @IsEnum(JobStatus)
  status: JobStatus;

  @IsString()
  @IsOptional()
  notes?: string; // Optional notes for status change
}
