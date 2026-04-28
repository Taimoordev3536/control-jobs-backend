import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateRatePlanDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyFixed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perWorkCenter?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  perWorker?: number;

  @IsOptional()
  isActive?: boolean;
}
