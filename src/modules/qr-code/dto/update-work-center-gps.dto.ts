import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateWorkCenterGpsDto {
  @IsBoolean()
  active: boolean;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  /** Allowed check-in radius in metres (default 100) */
  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(5000)
  radius?: number;
}
