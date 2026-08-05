import { IsOptional, IsBoolean, IsInt, IsNumber, IsIn, Min, Max } from 'class-validator';

/**
 * Every field optional and nullable: omitting one leaves it inheriting, and
 * sending null clears an override back to inherit.
 */
export class UpdateAttendancePolicyDto {
  @IsOptional() @IsBoolean()
  extraHoursAllowed?: boolean | null;

  @IsOptional() @IsInt() @Min(5) @Max(24 * 60)
  closeAfterShiftEndMins?: number | null;

  @IsOptional() @IsBoolean()
  recordScheduledEnd?: boolean | null;

  @IsOptional() @IsInt() @Min(15) @Max(7 * 24 * 60)
  extraHoursWaitMins?: number | null;

  @IsOptional() @IsInt() @Min(0) @Max(24 * 60)
  notifyWorkerAfterMins?: number | null;

  @IsOptional() @IsInt() @Min(0) @Max(7 * 24 * 60)
  notifyEmployerAfterMins?: number | null;

  @IsOptional() @IsInt() @Min(30) @Max(7 * 24 * 60)
  freeNotifyWorkerMins?: number | null;

  @IsOptional() @IsInt() @Min(30) @Max(7 * 24 * 60)
  freeNotifyEmployerMins?: number | null;

  @IsOptional() @IsInt() @Min(60) @Max(14 * 24 * 60)
  freeCloseAfterMins?: number | null;

  @IsOptional() @IsInt() @Min(0) @Max(12 * 60)
  earlyCheckinMins?: number | null;

  @IsOptional() @IsBoolean()
  countEarlyCheckin?: boolean | null;
  @IsOptional() @IsBoolean()
  overtimeRequiresApproval?: boolean | null;

  @IsOptional() @IsInt() @Min(0) @Max(2000)
  overtimeAnnualCapHours?: number | null;

  @IsOptional() @IsNumber() @Min(1) @Max(5)
  overtimeRateMultiplier?: number | null;

  @IsOptional() @IsIn(['PAID', 'TIME_OFF'])
  overtimeDefaultCompensation?: 'PAID' | 'TIME_OFF' | null;

  @IsOptional() @IsInt() @Min(0) @Max(365)
  vacationDaysPerYear?: number | null;

  @IsOptional() @IsIn(['NATURAL', 'WORKING'])
  vacationCountMode?: 'NATURAL' | 'WORKING' | null;

}
