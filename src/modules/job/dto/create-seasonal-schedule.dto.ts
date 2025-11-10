import { IsEnum, IsOptional, IsArray, ValidateNested, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { Season } from '../entities/shift.entity';
import { CreateWeeklyShiftDto } from './create-weekly-shift.dto';

export class CreateSeasonalScheduleDto {
  @IsEnum(Season)
  season: Season;

  // Accept DD-MM or DD/MM (we normalize to DD-MM) for seasonal period dates
  @IsOptional()
  @Matches(/^\d{2}[-\/]\d{2}$/,{ message: 'startDate must be in DD-MM format' })
  startDate?: string | null;

  @IsOptional()
  @Matches(/^\d{2}[-\/]\d{2}$/,{ message: 'endDate must be in DD-MM format' })
  endDate?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateWeeklyShiftDto)
  shifts: CreateWeeklyShiftDto[];
}
