import { IsString, IsOptional, IsIn } from 'class-validator';

export class ReviewManualAttendanceRequestDto {
  @IsIn(['APPROVE', 'REJECT'])
  action: 'APPROVE' | 'REJECT';

  @IsOptional()
  @IsString()
  reviewerNotes?: string;
}
