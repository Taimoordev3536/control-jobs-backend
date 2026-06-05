import { ArrayNotEmpty, IsArray, IsIn } from 'class-validator';
import { ALL_SEGMENTS, AudienceSegment } from '../audience.types';

export class PreviewAudienceDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ALL_SEGMENTS, { each: true })
  segments: AudienceSegment[];
}
