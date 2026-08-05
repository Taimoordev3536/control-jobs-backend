import { DateTime } from 'luxon';

/**
 * Single source of truth for the business timezone.
 *
 * The platform serves the Spanish market, but the server runs UTC (Render) and
 * developers are in Pakistan. All wall-clock decisions — display, "today"/"now"
 * comparisons, shift windows, fiscal issue dates, and scheduled-job periods —
 * MUST be anchored to Europe/Madrid regardless of where the process runs.
 * Timestamps themselves are still stored as true UTC instants (timestamptz);
 * only their wall-clock interpretation lives here.
 */
export const BUSINESS_TZ = 'Europe/Madrid';

/** Current instant as a Madrid-zoned Luxon DateTime. */
export function madridNow(): DateTime {
  return DateTime.now().setZone(BUSINESS_TZ);
}

function toDT(d: Date | string | null | undefined): DateTime | null {
  if (!d) return null;
  return DateTime.fromJSDate(new Date(d)).setZone(BUSINESS_TZ);
}

/** yyyy-MM-dd civil date of the instant, in Madrid. */
export function madridDateKey(d?: Date | string | null): string {
  const dt = toDT(d);
  return dt ? dt.toFormat('yyyy-MM-dd') : '';
}

/** dd/MM/yyyy civil date of the instant, in Madrid. */
export function madridDate(d?: Date | string | null): string {
  const dt = toDT(d);
  return dt ? dt.toFormat('dd/MM/yyyy') : '';
}

/** HH:mm (24h) wall-clock of the instant, in Madrid. */
export function madridTime(d?: Date | string | null): string {
  const dt = toDT(d);
  return dt ? dt.toFormat('HH:mm') : '';
}

/** Minutes since midnight (0-1439) of the instant, in Madrid. */
export function madridMinutes(d?: Date | string | null): number {
  const dt = toDT(d);
  return dt ? dt.hour * 60 + dt.minute : 0;
}

/**
 * Weekday of the instant in Madrid, matching JS `Date.getDay()`:
 * 0 = Sunday, 1 = Monday, ..., 6 = Saturday.
 */
export function madridWeekday(d?: Date | string | null): number {
  const dt = toDT(d);
  return dt ? dt.weekday % 7 : 0; // luxon weekday: 1=Mon..7=Sun → %7 maps Sun→0
}

/** Today's civil date in Madrid, as yyyy-MM-dd. */
export function madridTodayKey(): string {
  return madridNow().toFormat('yyyy-MM-dd');
}

/**
 * A Date whose LOCAL civil fields (getFullYear/getMonth/getDate) equal today's
 * date in Madrid. Use as a default "issue date" so both `toIsoDate`-style
 * formatting and `.getFullYear()` year extraction land on the Madrid civil day
 * rather than the server's UTC clock (which is a day/year behind for ~1-2h
 * after Madrid midnight).
 */
export function madridCivilToday(): Date {
  const m = madridNow();
  return new Date(m.year, m.month - 1, m.day);
}

/**
 * Previous full calendar month, anchored to Madrid "now". Returns both civil
 * Date objects (midnight-local, so they round-trip through local date
 * formatters unchanged) and yyyy-MM-dd strings. Used by the monthly billing
 * crons so the "which month" decision never drifts to the UTC clock.
 */
export function previousMonthRangeMadrid(): {
  startDate: Date;
  endDate: Date;
  startIso: string;
  endIso: string;
} {
  const prev = madridNow().minus({ months: 1 });
  const start = prev.startOf('month');
  const end = prev.endOf('month');
  return {
    startDate: new Date(start.year, start.month - 1, start.day),
    endDate: new Date(end.year, end.month - 1, end.day),
    startIso: start.toFormat('yyyy-MM-dd'),
    endIso: end.toFormat('yyyy-MM-dd'),
  };
}

/**
 * The instant, expressed as a Date whose *local fields* carry the Madrid wall
 * clock. Schedule readers work in local fields, so anything compared against a
 * shift has to be converted first — passing a raw instant reads it in the
 * server's zone, which is UTC in production and shifts the day.
 */
export function madridCivil(d: Date | string): Date {
  const t = DateTime.fromJSDate(new Date(d)).setZone(BUSINESS_TZ);
  return new Date(t.year, t.month - 1, t.day, t.hour, t.minute, t.second);
}

/** The reverse: a Madrid wall-clock Date back to the real instant it names. */
export function madridCivilToInstant(civil: Date): Date {
  return DateTime.fromObject(
    {
      year: civil.getFullYear(),
      month: civil.getMonth() + 1,
      day: civil.getDate(),
      hour: civil.getHours(),
      minute: civil.getMinutes(),
      second: civil.getSeconds(),
    },
    { zone: BUSINESS_TZ },
  ).toJSDate();
}
