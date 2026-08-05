export type VacationCountMode = 'NATURAL' | 'WORKING';

/**
 * Days an absence uses up.
 *
 * Spanish practice counts holiday either way and the convenio decides, so the
 * mode is a setting rather than a rule baked in here:
 *
 *   NATURAL  every calendar day between the two dates — art. 38 ET's own
 *            wording, 30 days a year
 *   WORKING  Monday to Friday only, minus the company's public holidays —
 *            how most convenios express it, ~22 days a year
 *
 * Both ends are inclusive: a one-day absence is one day, not zero.
 */
export function countAbsenceDays(
  startDate: string,
  endDate: string,
  mode: VacationCountMode,
  holidays: Set<string> = new Set(),
): number {
  if (!startDate || !endDate || endDate < startDate) return 0;

  // Parsed as UTC noon so a timezone offset can never roll a date over.
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(`${endDate}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  let days = 0;
  for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    if (mode === 'NATURAL') {
      days++;
      continue;
    }
    const weekday = d.getUTCDay();
    if (weekday === 0 || weekday === 6) continue;
    if (holidays.has(d.toISOString().slice(0, 10))) continue;
    days++;
  }
  return days;
}
