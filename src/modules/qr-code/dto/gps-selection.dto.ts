import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class GpsSelectionDto {
  @IsString()
  qrToken: string;

  // Optional: the worker may have denied location, or the fix may not have
  // arrived yet. Selection then falls back to "only one candidate" or a prompt.
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

  /** Device-reported fix accuracy in metres; widens the auto-pick margin. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  accuracy?: number;

  /** When provided, only return work centers that belong to this job. Accepts
   *  the UUID publicId or the numeric id — the caller sends whichever it has. */
  @IsOptional()
  @Transform(({ value }) => (value === null || value === undefined ? value : String(value)))
  @IsString()
  jobId?: string;
}
