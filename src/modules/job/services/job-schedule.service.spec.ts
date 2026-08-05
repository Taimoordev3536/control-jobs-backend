/**
 * Regression tests for the schedule/shift maths.
 *
 * Every case here was reproduced against production data before being written.
 * They encode two product rules confirmed with the business:
 *   1. A shift belongs to the day it STARTS. A shift running Sun 18:00 -> Mon
 *      06:00 is 12h of Sunday; Monday is 0.
 *   2. A season only wins if it actually has shifts. An empty summer period
 *      falls back to the normal schedule rather than emptying the job.
 */

// job.entity must be the first module of the entity cycle to load, otherwise
// ScheduleType is still undefined when job.entity's @Column decorator runs.
import '../entities/job.entity';
import { JobScheduleService } from './job-schedule.service';
import { ScheduleType, Weekday } from '../entities/schedule-type.enum';

type ShiftSeed = {
  startWeekday: Weekday | string;
  endWeekday: Weekday | string;
  baseStartTime: string;
  baseEndTime: string;
  isContinuous?: boolean;
  totalHours?: number | null;
  totalMinutes?: number | null;
};

const shift = (s: ShiftSeed): any => ({
  isContinuous: false,
  totalHours: null,
  totalMinutes: null,
  ...s,
});

const job = (opts: {
  scheduleType?: ScheduleType;
  seasons: Array<{ season: string; startDate?: string | null; endDate?: string | null; shifts: any[] }>;
}): any => ({
  id: 1,
  startDate: '2020-01-01',
  endDate: '2126-01-01',
  scheduleType: opts.scheduleType ?? ScheduleType.FIXED,
  seasonalSchedules: opts.seasons.map((s, i) => ({
    id: i + 1,
    season: s.season,
    startDate: s.startDate ?? null,
    endDate: s.endDate ?? null,
    shifts: s.shifts,
  })),
});

// Real calendar anchors (2026)
const MON = new Date(2026, 6, 27); // 27 Jul 2026 is a Monday
const TUE = new Date(2026, 6, 28);
const WED = new Date(2026, 6, 29);
const THU = new Date(2026, 6, 30);
const FRI = new Date(2026, 6, 31);
const SAT = new Date(2026, 7, 1);
const SUN = new Date(2026, 7, 2);
const JAN = new Date(2026, 0, 12); // a January Monday

describe('JobScheduleService', () => {
  let svc: JobScheduleService;
  beforeEach(() => {
    svc = new JobScheduleService();
  });

  // ── Sanity: the anchors really are the weekdays we think ──────────────
  it('test anchors are the expected weekdays', () => {
    expect([MON, TUE, WED, THU, FRI, SAT, SUN].map((d) => d.getDay())).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  // ══ Season selection ═══════════════════════════════════════════════════
  describe('season selection', () => {
    const summerShift = shift({ startWeekday: 'monday', endWeekday: 'monday', baseStartTime: '08:00:00', baseEndTime: '14:00:00', totalHours: 6 });
    const normalShift = shift({ startWeekday: 'monday', endWeekday: 'monday', baseStartTime: '08:00:00', baseEndTime: '17:00:00', totalHours: 9 });

    it('picks the summer season inside its date range', () => {
      const j = job({
        seasons: [
          { season: 'normal', startDate: null, endDate: null, shifts: [normalShift] },
          { season: 'summer', startDate: '10-06', endDate: '10-08', shifts: [summerShift] },
        ],
      });
      // 27 Jul 2026 falls inside 10 Jun -> 10 Aug
      expect(svc.getActiveSeasonalSchedule(j, MON)?.season).toBe('summer');
    });

    it('falls back to normal outside the summer range', () => {
      const j = job({
        seasons: [
          { season: 'normal', startDate: null, endDate: null, shifts: [normalShift] },
          { season: 'summer', startDate: '10-06', endDate: '10-08', shifts: [summerShift] },
        ],
      });
      expect(svc.getActiveSeasonalSchedule(j, JAN)?.season).toBe('normal');
    });

    it('falls back to normal when the summer period has no shifts', () => {
      // Business rule 2: an empty season must never empty the job.
      const j = job({
        seasons: [
          { season: 'normal', startDate: null, endDate: null, shifts: [normalShift] },
          { season: 'summer', startDate: '10-06', endDate: '10-08', shifts: [] },
        ],
      });
      expect(svc.getActiveSeasonalSchedule(j, MON)?.season).toBe('normal');
    });

    it('schedules a summer-only job during its summer period', () => {
      // The empty `normal` row is always persisted by the form; it must not
      // shadow a summer season that does have shifts.
      const j = job({
        seasons: [
          { season: 'normal', startDate: null, endDate: null, shifts: [] },
          { season: 'summer', startDate: '10-06', endDate: '10-08', shifts: [summerShift] },
        ],
      });
      expect(svc.isJobScheduledForDate(j, MON)).toBe(true);
      expect(svc.getShiftsForDate(j, MON)).toHaveLength(1);
    });

    it('honours a wrap-around season (Nov -> Mar)', () => {
      const j = job({
        seasons: [
          { season: 'summer', startDate: '15-06', endDate: '15-09', shifts: [summerShift] },
          { season: 'normal', startDate: '15-11', endDate: '15-03', shifts: [normalShift] },
        ],
      });
      expect(svc.getActiveSeasonalSchedule(j, JAN)?.season).toBe('normal');
    });
  });

  // ══ Scheduled minutes ══════════════════════════════════════════════════
  describe('getScheduledMinutesForDate', () => {
    // The schedule described by the business:
    //   Mon  none
    //   Tue  11:00 -> Wed 14:00   (27h)
    //   Thu  09:00 -> 10:00       (1h)
    //   Fri  none
    //   Sat  none
    //   Sun  18:00 -> Mon 06:00   (12h)
    const weekJob = () =>
      job({
        seasons: [
          {
            season: 'normal',
            shifts: [
              shift({ startWeekday: 'tuesday', endWeekday: 'wednesday', baseStartTime: '11:00:00', baseEndTime: '14:00:00', isContinuous: true, totalHours: 27 }),
              shift({ startWeekday: 'thursday', endWeekday: 'thursday', baseStartTime: '09:00:00', baseEndTime: '10:00:00', totalHours: 1 }),
              shift({ startWeekday: 'sunday', endWeekday: 'monday', baseStartTime: '18:00:00', baseEndTime: '06:00:00', isContinuous: true, totalHours: 12 }),
            ],
          },
        ],
      });

    it('counts a multi-day shift only on the day it starts', () => {
      const j = weekJob();
      expect(svc.getScheduledMinutesForDate(j, TUE)).toBe(27 * 60);
      expect(svc.getScheduledMinutesForDate(j, WED)).toBe(0);
    });

    it('gives Monday 0 when Sunday night spills into it', () => {
      // Business rule 1: the shift belongs to Sunday.
      expect(svc.getScheduledMinutesForDate(weekJob(), MON)).toBe(0);
      expect(svc.getScheduledMinutesForDate(weekJob(), SUN)).toBe(12 * 60);
    });

    it('totals the week at 40h, not 79h', () => {
      const j = weekJob();
      const total = [MON, TUE, WED, THU, FRI, SAT, SUN].reduce(
        (sum, d) => sum + svc.getScheduledMinutesForDate(j, d),
        0,
      );
      expect(total).toBe(40 * 60);
    });

    it('keeps the minutes of a half-hour shift', () => {
      const j = job({
        seasons: [
          {
            season: 'normal',
            shifts: [shift({ startWeekday: 'monday', endWeekday: 'monday', baseStartTime: '09:00:00', baseEndTime: '17:30:00', totalHours: 8 })],
          },
        ],
      });
      // 09:00 -> 17:30 is 510 minutes. Whole-hour totalHours must not win.
      expect(svc.getScheduledMinutesForDate(j, MON)).toBe(510);
    });

    it('returns 0 for days with no shift', () => {
      const j = weekJob();
      expect(svc.getScheduledMinutesForDate(j, FRI)).toBe(0);
      expect(svc.getScheduledMinutesForDate(j, SAT)).toBe(0);
    });

    it('returns 0 for a FREE job', () => {
      const j = job({ scheduleType: ScheduleType.FREE, seasons: [{ season: 'normal', shifts: [] }] });
      expect(svc.getScheduledMinutesForDate(j, MON)).toBe(0);
    });
  });

  // ══ Shift end instant — needed later by auto-close ═════════════════════
  describe('getShiftEndFor', () => {
    it('resolves the real end moment of a shift that crosses days', () => {
      const s = shift({ startWeekday: 'tuesday', endWeekday: 'wednesday', baseStartTime: '11:00:00', baseEndTime: '14:00:00', isContinuous: true, totalHours: 27 });
      // Started Tuesday 28 Jul 11:00 -> ends Wednesday 29 Jul 14:00
      const end = svc.getShiftEndFor(s, TUE);
      expect(end.getFullYear()).toBe(2026);
      expect(end.getMonth()).toBe(6);
      expect(end.getDate()).toBe(29);
      expect(end.getHours()).toBe(14);
    });

    it('resolves an overnight shift ending the next morning', () => {
      const s = shift({ startWeekday: 'sunday', endWeekday: 'monday', baseStartTime: '18:00:00', baseEndTime: '06:00:00', isContinuous: true, totalHours: 12 });
      const end = svc.getShiftEndFor(s, SUN); // Sun 2 Aug -> Mon 3 Aug 06:00
      expect(end.getDate()).toBe(3);
      expect(end.getHours()).toBe(6);
    });

    it('resolves a same-day shift', () => {
      const s = shift({ startWeekday: 'thursday', endWeekday: 'thursday', baseStartTime: '09:00:00', baseEndTime: '10:00:00', totalHours: 1 });
      const end = svc.getShiftEndFor(s, THU);
      expect(end.getDate()).toBe(30);
      expect(end.getHours()).toBe(10);
    });
  });

  // ══ Day window (control screen / calendars) ════════════════════════════
  describe('getDayWindow', () => {
    it('reports the night shift as the day end, not the day shift', () => {
      // "06:00" sorts below "14:00" as text, so taking the lexicographic max
      // used to hide the night shift entirely.
      const j = job({
        seasons: [
          {
            season: 'normal',
            shifts: [
              shift({ startWeekday: 'monday', endWeekday: 'monday', baseStartTime: '06:00:00', baseEndTime: '14:00:00', totalHours: 8 }),
              shift({ startWeekday: 'monday', endWeekday: 'tuesday', baseStartTime: '22:00:00', baseEndTime: '06:00:00', isContinuous: true, totalHours: 8 }),
            ],
          },
        ],
      });
      expect(svc.getDayWindow(j, MON)).toEqual({ startTime: '06:00:00', endTime: '06:00:00' });
    });

    it('is empty on a day with no shift', () => {
      const j = job({ seasons: [{ season: 'normal', shifts: [shift({ startWeekday: 'monday', endWeekday: 'monday', baseStartTime: '09:00:00', baseEndTime: '17:00:00', totalHours: 8 })] }] });
      expect(svc.getDayWindow(j, TUE)).toEqual({ startTime: null, endTime: null });
    });
  });

  // ══ Shift length from raw values ═══════════════════════════════════════
  describe('getShiftSpanMinutes', () => {
    it('keeps the minutes of an 8h30 shift', () => {
      expect(svc.getShiftSpanMinutes('monday', '09:00', 'monday', '17:30')).toBe(510);
    });
    it('handles a shift that wraps the week (Fri -> Mon)', () => {
      expect(svc.getShiftSpanMinutes('friday', '03:00', 'monday', '03:00')).toBe(72 * 60);
    });
    it('handles same-day overnight (22:00 -> 06:00)', () => {
      expect(svc.getShiftSpanMinutes('monday', '22:00', 'monday', '06:00')).toBe(8 * 60);
    });
  });

  // ══ Half-configured season ═════════════════════════════════════════════
  describe('a season with only one date set', () => {
    it('is never active', () => {
      const withShifts = [shift({ startWeekday: 'monday', endWeekday: 'monday', baseStartTime: '08:00:00', baseEndTime: '16:00:00', totalHours: 8 })];
      const j = job({
        seasons: [
          { season: 'normal', startDate: null, endDate: null, shifts: withShifts },
          // endDate failed to parse and was stored as null
          { season: 'summer', startDate: '10-06', endDate: null, shifts: withShifts },
        ],
      });
      expect(svc.getActiveSeasonalSchedule(j, MON)?.season).toBe('normal');
    });
  });

  // ══ Check-in window ════════════════════════════════════════════════════
  describe('isWithinCheckInWindow', () => {
    const at = (d: Date, h: number, m = 0) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);

    // Mirrors live job 19: two shifts on different weekdays.
    const twoDayJob = () =>
      job({
        seasons: [
          {
            season: 'normal',
            shifts: [
              shift({ startWeekday: 'wednesday', endWeekday: 'wednesday', baseStartTime: '02:00:00', baseEndTime: '15:00:00', totalHours: 13 }),
              shift({ startWeekday: 'friday', endWeekday: 'friday', baseStartTime: '01:00:00', baseEndTime: '22:00:00', totalHours: 21 }),
            ],
          },
        ],
      });

    it("rejects a time covered only by another weekday's shift", () => {
      // Wed 23:30 used to be allowed because Friday's 01:00-22:00 window was
      // also being tested against Wednesday.
      expect(svc.isWithinCheckInWindow(twoDayJob(), at(WED, 23, 30)).allowed).toBe(false);
    });

    it('allows a check-in during its own shift', () => {
      expect(svc.isWithinCheckInWindow(twoDayJob(), at(WED, 10)).allowed).toBe(true);
    });

    it('allows the 30 minute early grace', () => {
      expect(svc.isWithinCheckInWindow(twoDayJob(), at(WED, 1, 35)).allowed).toBe(true);
    });

    it('allows the 2 hour late grace but not beyond', () => {
      expect(svc.isWithinCheckInWindow(twoDayJob(), at(WED, 16, 30)).allowed).toBe(true);
      expect(svc.isWithinCheckInWindow(twoDayJob(), at(WED, 17, 30)).allowed).toBe(false);
    });

    // Overnight shift — the regression risk of only looking at today's shifts.
    const nightJob = () =>
      job({
        seasons: [
          {
            season: 'normal',
            shifts: [shift({ startWeekday: 'sunday', endWeekday: 'monday', baseStartTime: '18:00:00', baseEndTime: '06:00:00', isContinuous: true, totalHours: 12 })],
          },
        ],
      });

    it('allows a worker arriving on Monday for a shift that began Sunday', () => {
      // The shift starts Sunday, so Monday has no shift of its own — but the
      // worker is still inside it at 00:30.
      expect(svc.isWithinCheckInWindow(nightJob(), at(MON, 0, 30)).allowed).toBe(true);
    });

    it('allows the late grace after an overnight shift ends', () => {
      expect(svc.isWithinCheckInWindow(nightJob(), at(MON, 7, 30)).allowed).toBe(true);
      expect(svc.isWithinCheckInWindow(nightJob(), at(MON, 9)).allowed).toBe(false);
    });

    it('allows a check-in mid-way through a multi-day shift', () => {
      const j = job({
        seasons: [
          {
            season: 'normal',
            shifts: [shift({ startWeekday: 'tuesday', endWeekday: 'wednesday', baseStartTime: '11:00:00', baseEndTime: '14:00:00', isContinuous: true, totalHours: 27 })],
          },
        ],
      });
      expect(svc.isWithinCheckInWindow(j, at(WED, 9)).allowed).toBe(true);
      expect(svc.isWithinCheckInWindow(j, at(WED, 17)).allowed).toBe(false);
    });

    it('never blocks a FREE job', () => {
      const j = job({ scheduleType: ScheduleType.FREE, seasons: [{ season: 'normal', shifts: [] }] });
      expect(svc.isWithinCheckInWindow(j, at(WED, 3)).allowed).toBe(true);
    });

    it('is not enforced when the job has no shifts configured', () => {
      const j = job({ seasons: [{ season: 'normal', shifts: [] }] });
      expect(svc.isWithinCheckInWindow(j, at(WED, 3)).allowed).toBe(true);
    });
  });

  // ══ getShiftsStartingOn ════════════════════════════════════════════════
  // Separate from getShiftsForDate, which stays "any shift covering this day"
  // because check-in still has to accept a worker arriving for a shift that
  // began the previous evening.
  describe('getShiftsStartingOn', () => {
    it('returns only the shifts that START on the given day', () => {
      const j = job({
        seasons: [
          {
            season: 'normal',
            shifts: [
              shift({ startWeekday: 'wednesday', endWeekday: 'wednesday', baseStartTime: '02:00:00', baseEndTime: '15:00:00', totalHours: 13 }),
              shift({ startWeekday: 'friday', endWeekday: 'friday', baseStartTime: '01:00:00', baseEndTime: '22:00:00', totalHours: 21 }),
            ],
          },
        ],
      });
      const wed = svc.getShiftsStartingOn(j, WED);
      expect(wed).toHaveLength(1);
      expect(wed[0].baseStartTime).toBe('02:00:00');
    });

    it('does not return a shift that only spills into the day', () => {
      const j = job({
        seasons: [
          {
            season: 'normal',
            shifts: [shift({ startWeekday: 'sunday', endWeekday: 'monday', baseStartTime: '18:00:00', baseEndTime: '06:00:00', isContinuous: true, totalHours: 12 })],
          },
        ],
      });
      expect(svc.getShiftsStartingOn(j, MON)).toHaveLength(0);
      expect(svc.getShiftsStartingOn(j, SUN)).toHaveLength(1);
      // ...but check-in gating still sees Monday as covered.
      expect(svc.getShiftsForDate(j, MON)).toHaveLength(1);
    });
  });
});
