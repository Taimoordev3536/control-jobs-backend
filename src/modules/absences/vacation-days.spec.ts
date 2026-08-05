import { countAbsenceDays } from './vacation-days';

describe('countAbsenceDays', () => {
  // 2026-07-06 is a Monday, 2026-07-12 the Sunday that closes that week.
  const MON = '2026-07-06';
  const FRI = '2026-07-10';
  const SUN = '2026-07-12';

  describe('natural days', () => {
    it('counts every calendar day, both ends included', () => {
      expect(countAbsenceDays(MON, SUN, 'NATURAL')).toBe(7);
    });

    it('counts a single day as one, not zero', () => {
      expect(countAbsenceDays(MON, MON, 'NATURAL')).toBe(1);
    });

    it('ignores weekends and holidays by definition', () => {
      expect(countAbsenceDays(MON, SUN, 'NATURAL', new Set([FRI]))).toBe(7);
    });
  });

  describe('working days', () => {
    it('drops the weekend', () => {
      expect(countAbsenceDays(MON, SUN, 'WORKING')).toBe(5);
    });

    it('drops a public holiday inside the range', () => {
      expect(countAbsenceDays(MON, FRI, 'WORKING', new Set([FRI]))).toBe(4);
    });

    it('is zero for a weekend-only range', () => {
      expect(countAbsenceDays('2026-07-11', SUN, 'WORKING')).toBe(0);
    });

    it('counts a single working day as one', () => {
      expect(countAbsenceDays(MON, MON, 'WORKING')).toBe(1);
    });

    it('spans months and years', () => {
      // 2026-12-28 Mon .. 2027-01-01 Fri, minus New Year's Day
      expect(countAbsenceDays('2026-12-28', '2027-01-01', 'WORKING', new Set(['2027-01-01']))).toBe(4);
    });
  });

  describe('bad input', () => {
    it('is zero when the end is before the start', () => {
      expect(countAbsenceDays(FRI, MON, 'WORKING')).toBe(0);
    });

    it('is zero when a date is missing', () => {
      expect(countAbsenceDays('', FRI, 'WORKING')).toBe(0);
      expect(countAbsenceDays(MON, '', 'WORKING')).toBe(0);
    });
  });

  it('does not roll a date over on a timezone offset', () => {
    // The machine running this sits at UTC+5; a naive local Date would make
    // the first day land on the previous evening and drop out of the range.
    expect(countAbsenceDays('2026-07-06', '2026-07-06', 'WORKING')).toBe(1);
    expect(countAbsenceDays('2026-07-01', '2026-07-31', 'NATURAL')).toBe(31);
  });
});
