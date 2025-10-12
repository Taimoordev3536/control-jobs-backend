import { IsEnum, IsDateString, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Season } from '../entities/shift.entity';
import { CreateWeeklyShiftDto } from './create-weekly-shift.dto';

export class CreateSeasonalScheduleDto {
  @IsEnum(Season)
  season: Season;

  @IsDateString()
  @IsOptional()
  startDate?: string | null;

  @IsDateString()
  @IsOptional()
  endDate?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWeeklyShiftDto)
  shifts: CreateWeeklyShiftDto[];
}
