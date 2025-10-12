import { IsEnum, IsDateString } from 'class-validator';
import { Season } from '../entities/shift.entity';

export class CreateSeasonPeriodDto {
  @IsEnum(Season)
  season: Season;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
