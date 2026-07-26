/**
 * ScheduleType and Weekday live here rather than in shift.entity for the same
 * reason Season does (see season.enum.ts): shift.entity imports
 * SeasonalSchedule, seasonal-schedule.entity imports Job, and job.entity needs
 * ScheduleType at @Column-decoration time. With the enums defined inside
 * shift.entity that cycle can leave ScheduleType `undefined` when job.entity is
 * evaluated first, which throws
 *
 *   TypeError: Cannot read properties of undefined (reading 'FREE')
 *
 * Nest happens to load the files in a working order today, so this only
 * surfaced when the modules were imported directly (a test harness, a script).
 * Standalone modules have no cycle, so these are always defined.
 */

export enum ScheduleType {
  FIXED = 'fixed',
  FREE = 'free',
  SEASONAL = 'seasonal',
}

export enum Weekday {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}
