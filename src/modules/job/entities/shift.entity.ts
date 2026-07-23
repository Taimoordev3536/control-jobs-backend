import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { SeasonalSchedule } from './seasonal-schedule.entity';

export enum ShiftType {
  MORNING = 'morning',
  NOON = 'noon',
  EVENING = 'evening',
}

export enum ScheduleType {
  FIXED = 'fixed',
  FREE = 'free',
  SEASONAL = 'seasonal',
}

// Re-exported from its own module so existing `import { Season } from
// './shift.entity'` call sites keep working, without shift.entity being the
// definition site (which created the circular-import hazard).
export { Season } from './season.enum';

export enum Weekday {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

@Entity('shift')
export class Shift {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SeasonalSchedule, seasonalSchedule => seasonalSchedule.shifts, { nullable: false })
  @JoinColumn({ name: 'seasonal_schedule_id' })
  seasonalSchedule: SeasonalSchedule;

  @Column({ name: 'seasonal_schedule_id' })
  seasonalScheduleId: number;

  @Column({ type: 'enum', enum: Weekday, enumName: 'weekday_enum', nullable: false, name: 'start_weekday' })
  startWeekday: Weekday;

  @Column({ type: 'enum', enum: Weekday, enumName: 'weekday_enum', nullable: false, name: 'end_weekday' })
  endWeekday: Weekday;

  @Column({ type: 'time', nullable: false, name: 'base_start_time' })
  baseStartTime: string;

  @Column({ type: 'time', nullable: false, name: 'base_end_time' })
  baseEndTime: string;

  @Column({ type: 'boolean', default: false, name: 'is_continuous' })
  isContinuous: boolean;

  @Column({ type: 'int', nullable: true, name: 'total_hours' })
  totalHours?: number;
}