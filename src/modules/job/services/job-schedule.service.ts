import { Injectable } from '@nestjs/common';
import { Job } from '../entities/job.entity';
import { SeasonalSchedule } from '../entities/seasonal-schedule.entity';
import { Shift } from '../entities/shift.entity';
import { Weekday, ScheduleType } from '../entities/schedule-type.enum';

const WEEKDAY_ORDER: Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
];

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
    const start = this.getDateWithoutTime(this.parseCivilDate(job.startDate));
    const end = this.getDateWithoutTime(this.parseCivilDate(job.endDate));

    return target >= start && target <= end;
  }

  /**
   * Parse a date-only value (a `date` column, usually a 'YYYY-MM-DD' string)
   * into a local Date anchored at noon. The noon anchor makes reading the
   * local calendar fields yield the intended civil day on ANY server timezone,
   * including negative-offset hosts where `new Date('YYYY-MM-DD')` (UTC
   * midnight) would otherwise roll back to the previous day.
   */
  private parseCivilDate(value: string | Date): Date {
    if (value instanceof Date) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12);
    }
    return new Date(`${String(value).slice(0, 10)}T12:00:00`);
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

    const matching = job.seasonalSchedules.filter((s) => this.isDateInSeasonRange(targetDate, s));
    if (matching.length === 0) return null;

    // A dated season (summer) is more specific than an always-on one (normal).
    const dated = matching.filter((s) => !!s.startDate && !!s.endDate);
    const alwaysOn = matching.filter((s) => !s.startDate || !s.endDate);

    // ...but only if it has shifts: an empty season must never empty the job.
    const withShifts = (list: SeasonalSchedule[]) => list.find((s) => s.shifts?.length);

    return (
      withShifts(dated) ??
      withShifts(alwaysOn) ??
      dated[0] ??
      alwaysOn[0] ??
      null
    );
  }

  /**
   * Check if a date falls within a seasonal schedule's date range
   * Handles year-wrapping seasons (e.g., winter: 15-11 to 15-03)
   */
  private isDateInSeasonRange(date: Date, season: SeasonalSchedule): boolean {
    // Only a season with NEITHER date is the always-on one; half-set is invalid.
    if (!season.startDate && !season.endDate) return true;
    if (!season.startDate || !season.endDate) return false;

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
    const weekdayOrder = WEEKDAY_ORDER;

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

  /**
   * Shifts that apply to a job on a given date (active season + matching weekday).
   * Empty for FREE jobs or dates with no shift.
   */
  getShiftsForDate(job: Job, targetDate: Date): Shift[] {
    if (!this.isJobScheduledForDate(job, targetDate)) return [];
    if (job.scheduleType === ScheduleType.FREE) return [];
    const schedule = this.getActiveSeasonalSchedule(job, targetDate);
    if (!schedule?.shifts) return [];
    const weekday = this.getWeekdayFromDate(targetDate);
    return schedule.shifts.filter((s) =>
      this.isWeekdayInShiftRange(weekday, s.startWeekday, s.endWeekday),
    );
  }

  /** Shifts that BEGIN on this date, unlike getShiftsForDate which reports every shift touching it. */
  getShiftsStartingOn(job: Job, targetDate: Date): Shift[] {
    if (!this.isJobScheduledForDate(job, targetDate)) return [];
    if (job.scheduleType === ScheduleType.FREE) return [];
    const schedule = this.getActiveSeasonalSchedule(job, targetDate);
    if (!schedule?.shifts) return [];
    const weekday = this.getWeekdayFromDate(targetDate);
    return schedule.shifts.filter((s) => s.startWeekday === weekday);
  }

  /** A shift counts once, on the day it starts. */
  getScheduledMinutesForDate(job: Job, targetDate: Date): number {
    if (job.scheduleType === ScheduleType.FREE) return 0;
    return this.getShiftsStartingOn(job, targetDate).reduce(
      (sum, shift) => sum + this.getShiftMinutes(shift),
      0,
    );
  }

  /** Shift occurrences running near `instant`. Looks back a week: shifts can span days. */
  /**
   * The shift a check-in belongs to: the latest one that had already started.
   *
   * Callers were using getShiftsForDate and taking the earliest start, but
   * that returns any shift *touching* the day — deliberately including one
   * that began yesterday. On a Sunday 18:00 to Monday 06:00 shift, a worker
   * arriving Monday at 00:30 was compared against 18:00 and called early
   * instead of six hours late.
   *
   * `instant` must carry Madrid wall-clock local fields.
   */
  getShiftForCheckIn(job: Job, instant: Date): { shift: Shift; start: Date; end: Date } | null {
    const occurrences = this.getShiftOccurrencesAround(job, instant);
    if (!occurrences.length) return null;
    const t = instant.getTime();
    const GRACE = 60 * 60_000;
    // Must actually cover the moment. Taking "the latest that had begun"
    // alone reached back through the whole week the search window spans and
    // matched the same weekday's shift seven days earlier.
    const covering = occurrences
      .filter((o) => o.start.getTime() - GRACE <= t && t <= o.end.getTime())
      .sort((a, b) => b.start.getTime() - a.start.getTime());
    return covering[0] ?? null;
  }

  getShiftOccurrencesAround(
    job: Job,
    instant: Date,
  ): Array<{ shift: Shift; start: Date; end: Date }> {
    const occurrences: Array<{ shift: Shift; start: Date; end: Date }> = [];
    for (let daysBack = 0; daysBack <= 7; daysBack++) {
      const day = new Date(
        instant.getFullYear(),
        instant.getMonth(),
        instant.getDate() - daysBack,
      );
      for (const shift of this.getShiftsStartingOn(job, day)) {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        start.setMinutes(this.parseTimeToMinutes(shift.baseStartTime) ?? 0);
        occurrences.push({ shift, start, end: this.getShiftEndFor(shift, day) });
      }
    }
    return occurrences;
  }

  /** Compares against each shift's real start/end moments, not minutes-of-day. */
  isWithinCheckInWindow(
    job: Job,
    instant: Date,
    opts: { earlyGraceMins?: number; lateGraceMins?: number; signingMethod?: string } = {},
  ): { allowed: boolean; reason?: string } {
    const { earlyGraceMins = 30, lateGraceMins = 120, signingMethod } = opts;

    if (job.scheduleType === ScheduleType.FREE) return { allowed: true };

    const active = this.getActiveSeasonalSchedule(job, instant);
    // No schedule or no shifts configured — the window is simply not enforced.
    if (!active?.shifts?.length) return { allowed: true };

    const occurrences = this.getShiftOccurrencesAround(job, instant);
    if (occurrences.length === 0) {
      return { allowed: false, reason: 'No shift is scheduled for today' };
    }

    // GPS keeps its existing product rule: a shift must exist, but the time of
    // day is not restricted.
    if (signingMethod === 'gps') return { allowed: true };

    const t = instant.getTime();
    for (const { start, end } of occurrences) {
      if (t >= start.getTime() - earlyGraceMins * 60_000 && t <= end.getTime() + lateGraceMins * 60_000) {
        return { allowed: true };
      }
    }
    return {
      allowed: false,
      reason: 'Current time is outside the allowed check-in window for any shift today',
    };
  }

  /** Earliest start and the end of whichever shift finishes last.
   *  Ordered by real end moment: "06:00" sorts below "14:00" as text. */
  getDayWindow(
    job: Job,
    targetDate: Date,
  ): { startTime: string | null; endTime: string | null } {
    const occurrences = this.getShiftsStartingOn(job, targetDate).map((shift) => ({
      shift,
      end: this.getShiftEndFor(shift, targetDate),
    }));
    if (occurrences.length === 0) return { startTime: null, endTime: null };

    const earliestStart = occurrences
      .map((o) => o.shift.baseStartTime)
      .filter(Boolean)
      .sort()[0] ?? null;

    const latest = occurrences.reduce((a, b) => (b.end > a.end ? b : a));
    return { startTime: earliestStart, endTime: latest.shift.baseEndTime ?? null };
  }

  /** Total scheduled minutes across a whole week of the active season. */
  getWeeklyMinutes(job: Job, targetDate: Date): number {
    if (job.scheduleType === ScheduleType.FREE) return 0;
    const active = this.getActiveSeasonalSchedule(job, targetDate);
    if (!active?.shifts?.length) return 0;
    return active.shifts.reduce((sum, shift) => sum + this.getShiftMinutes(shift), 0);
  }

  /** Season label + weekly hours for the job cards. */
  getScheduleSummary(
    job: Job,
    targetDate: Date,
  ): { scheduleType: string; weekHours: number | null } {
    if (job.scheduleType === ScheduleType.FREE) {
      return { scheduleType: 'free', weekHours: null };
    }
    if (job.scheduleType === ScheduleType.FIXED) {
      return { scheduleType: 'fixed', weekHours: this.getWeeklyMinutes(job, targetDate) / 60 };
    }
    const active = this.getActiveSeasonalSchedule(job, targetDate);
    if (!active) return { scheduleType: 'seasonal', weekHours: null };
    return {
      scheduleType: String(active.season),
      weekHours: this.getWeeklyMinutes(job, targetDate) / 60,
    };
  }

  /** The moment a shift ends, given the date it started on. */
  getShiftEndFor(shift: Shift, shiftStartDate: Date): Date {
    const startMins = this.parseTimeToMinutes(shift.baseStartTime) ?? 0;
    const end = new Date(
      shiftStartDate.getFullYear(),
      shiftStartDate.getMonth(),
      shiftStartDate.getDate(),
    );
    end.setMinutes(startMins + this.getShiftMinutes(shift));
    return end;
  }

  /** Derived from weekdays + times; `totalHours` is whole-hours and lossy. */
  private getShiftMinutes(shift: Shift): number {
    return this.getShiftSpanMinutes(
      shift.startWeekday,
      shift.baseStartTime,
      shift.endWeekday,
      shift.baseEndTime,
    );
  }

  /** Same calculation from raw values, for callers holding a DTO. */
  getShiftSpanMinutes(
    startWeekday: Weekday | string,
    baseStartTime: string,
    endWeekday: Weekday | string,
    baseEndTime: string,
  ): number {
    const start = this.parseTimeToMinutes(baseStartTime);
    const end = this.parseTimeToMinutes(baseEndTime);
    if (start == null || end == null) return 0;

    const startIdx = WEEKDAY_ORDER.indexOf(String(startWeekday).toLowerCase() as Weekday);
    const endIdx = WEEKDAY_ORDER.indexOf(String(endWeekday).toLowerCase() as Weekday);
    if (startIdx === -1 || endIdx === -1) return 0;

    let dayGap = endIdx - startIdx;
    if (dayGap < 0) dayGap += 7;

    let minutes = dayGap * 24 * 60 + (end - start);
    // Same weekday with an end at or before the start is an overnight shift
    // (e.g. 22:00 -> 06:00) recorded without advancing endWeekday.
    if (minutes <= 0) minutes += 24 * 60;
    return minutes;
  }

  private parseTimeToMinutes(time: string): number | null {
    if (!time) return null;
    const [h, m] = time.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  }
}
