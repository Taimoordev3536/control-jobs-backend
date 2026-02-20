import { Injectable } from '@nestjs/common';
import { Job } from '../entities/job.entity';
import { SeasonalSchedule } from '../entities/seasonal-schedule.entity';
import { Weekday, ScheduleType } from '../entities/shift.entity';

@Injectable()
export class JobScheduleService {
  /**
   * Check if a job is scheduled for a specific date
   * This considers:
   * 1. Job date range (startDate to endDate)
   * 2. Active seasonal schedule for the date
   * 3. Weekday shifts in the seasonal schedule
   */
  isJobScheduledForDate(job: Job, targetDate: Date): boolean {
    // 1. Check if date is within job date range
    if (!this.isDateInJobRange(job, targetDate)) {
      return false;
    }

    // 2. For FREE schedule type, job is always scheduled within date range
    if (job.scheduleType === ScheduleType.FREE) {
      return true;
    }

    // 3. For SEASONAL schedule type, check seasonal schedules
    if (job.scheduleType === ScheduleType.SEASONAL) {
      return this.isDateInSeasonalSchedule(job, targetDate);
    }

    // 4. For FIXED schedule type, check seasonal schedules (legacy compatibility)
    if (job.scheduleType === ScheduleType.FIXED) {
      return this.isDateInSeasonalSchedule(job, targetDate);
    }

    // Default: If no schedule type or unknown type, don't include
    return false;
  }

  /**
   * Check if date falls within job's start and end date range
   */
  private isDateInJobRange(job: Job, targetDate: Date): boolean {
    const target = this.getDateWithoutTime(targetDate);
    const start = this.getDateWithoutTime(new Date(job.startDate));
    const end = this.getDateWithoutTime(new Date(job.endDate));

    return target >= start && target <= end;
  }

  /**
   * Check if date is scheduled in any seasonal schedule with matching shifts
   */
  private isDateInSeasonalSchedule(job: Job, targetDate: Date): boolean {
    if (!job.seasonalSchedules || job.seasonalSchedules.length === 0) {
      // No seasonal schedules defined, assume not scheduled
      return false;
    }

    // Get active seasonal schedule for this date
    const activeSchedule = this.getActiveSeasonalSchedule(job, targetDate);

    if (!activeSchedule) {
      // No active seasonal schedule for this date
      return false;
    }

    // Check if the weekday has shifts in this seasonal schedule
    return this.hasShiftForWeekday(activeSchedule, targetDate);
  }

  /**
   * Get the active seasonal schedule for a given date
   * Checks if date falls within the season's date range
   */
  getActiveSeasonalSchedule(job: Job, targetDate: Date): SeasonalSchedule | null {
    if (!job.seasonalSchedules || job.seasonalSchedules.length === 0) {
      return null;
    }

    for (const schedule of job.seasonalSchedules) {
      if (this.isDateInSeasonRange(targetDate, schedule)) {
        return schedule;
      }
    }

    return null;
  }

  /**
   * Check if a date falls within a seasonal schedule's date range
   * Handles year-wrapping seasons (e.g., winter: 15-11 to 15-03)
   */
  private isDateInSeasonRange(date: Date, season: SeasonalSchedule): boolean {
    if (!season.startDate || !season.endDate) {
      // If no date range specified, assume always active
      return true;
    }

    // Convert DD-MM strings to numeric MMDD for correct lexicographic comparison
    // e.g. "15-06" (Jun 15) → 615, "01-09" (Sep 1) → 901
    // This ensures Aug 31 (831) < Sep 1 (901) which "DD-MM" string comparison gets wrong
    const toMMDD = (ddmm: string): number => {
      const [dd, mm] = ddmm.split('-').map(Number);
      return mm * 100 + dd;
    };

    const target = toMMDD(this.formatDayMonth(date));
    const start  = toMMDD(season.startDate);
    const end    = toMMDD(season.endDate);

    if (start <= end) {
      // Same-year range (e.g., summer: Jun 1 → Aug 31)
      return target >= start && target <= end;
    } else {
      // Year-wrapping range (e.g., winter: Nov 15 → Mar 15)
      return target >= start || target <= end;
    }
  }

  /**
   * Check if a weekday has shifts in the seasonal schedule
   */
  hasShiftForWeekday(seasonalSchedule: SeasonalSchedule, date: Date): boolean {
    if (!seasonalSchedule.shifts || seasonalSchedule.shifts.length === 0) {
      // No shifts defined, assume not scheduled
      return false;
    }

    const targetWeekday = this.getWeekdayFromDate(date);

    // Check if any shift includes this weekday
    for (const shift of seasonalSchedule.shifts) {
      if (this.isWeekdayInShiftRange(targetWeekday, shift.startWeekday, shift.endWeekday)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a weekday falls within a shift's weekday range
   * Handles ranges like Monday-Friday, Saturday-Sunday, or Friday-Monday (week wrapping)
   */
  private isWeekdayInShiftRange(
    targetWeekday: Weekday,
    startWeekday: Weekday,
    endWeekday: Weekday,
  ): boolean {
    const weekdayOrder = [
      Weekday.MONDAY,
      Weekday.TUESDAY,
      Weekday.WEDNESDAY,
      Weekday.THURSDAY,
      Weekday.FRIDAY,
      Weekday.SATURDAY,
      Weekday.SUNDAY,
    ];

    const targetIndex = weekdayOrder.indexOf(targetWeekday);
    const startIndex = weekdayOrder.indexOf(startWeekday);
    const endIndex = weekdayOrder.indexOf(endWeekday);

    if (startIndex <= endIndex) {
      // Normal range (e.g., Monday to Friday)
      return targetIndex >= startIndex && targetIndex <= endIndex;
    } else {
      // Week-wrapping range (e.g., Friday to Monday)
      return targetIndex >= startIndex || targetIndex <= endIndex;
    }
  }

  /**
   * Get weekday enum from Date object
   */
  private getWeekdayFromDate(date: Date): Weekday {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    const weekdayMap = {
      0: Weekday.SUNDAY,
      1: Weekday.MONDAY,
      2: Weekday.TUESDAY,
      3: Weekday.WEDNESDAY,
      4: Weekday.THURSDAY,
      5: Weekday.FRIDAY,
      6: Weekday.SATURDAY,
    };

    return weekdayMap[dayOfWeek];
  }

  /**
   * Format date as DD-MM string
   */
  private formatDayMonth(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${day}-${month}`;
  }

  /**
   * Get date without time component for accurate comparison
   */
  private getDateWithoutTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  /**
   * Get all jobs scheduled for a specific date from a list of jobs
   */
  filterJobsScheduledForDate(jobs: Job[], targetDate: Date): Job[] {
    return jobs.filter(job => this.isJobScheduledForDate(job, targetDate));
  }
}
