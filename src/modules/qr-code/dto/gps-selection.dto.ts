import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GpsSelectionDto {
  @IsString()
  qrToken: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  /** When provided, only return work centers that belong to this job */
  @IsOptional()
  @IsNumber()
  jobId?: number;
}
