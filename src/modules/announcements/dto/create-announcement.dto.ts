import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ALL_SEGMENTS, AudienceSegment } from '../audience.types';

export class CreateAnnouncementDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ALL_SEGMENTS, { each: true })
  segments: AudienceSegment[];

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  subject: string;

  @IsString()
  @MinLength(1)
  body: string;

  @IsOptional()
  @IsIn(['INFO', 'WARNING', 'CRITICAL'])
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
