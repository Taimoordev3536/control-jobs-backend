import { OvertimeService } from './overtime.service';

/**
 * The rules the figure has to obey.
 *
 * The third case is the one deriving from scheduled minutes alone got wrong:
 * a job with a roster but no shift on that day is a rest day, and a session
 * on it is entirely time beyond the ordinary working day — not zero. Real
 * data had a 121-hour Tuesday session on a Friday-only job reporting no
 * overtime at all.
 */
describe('OvertimeService.decide', () => {
  // decide() is pure; nothing it touches is injected.
  const svc = new OvertimeService(
    ...(Array(8).fill(null) as [any, any, any, any, any, any, any, any]),
  );

  describe('a job with a roster, on a scheduled day', () => {
    it('is the excess over the scheduled day', () => {
      expect(svc.decide(true, 480, 540).minutes).toBe(60);
    });

    it('is zero when the day was not exceeded', () => {
      expect(svc.decide(true, 480, 420).minutes).toBe(0);
    });

    it('never goes negative', () => {
      expect(svc.decide(true, 480, 0).minutes).toBe(0);
    });

    it('counts a full extra shift', () => {
      expect(svc.decide(true, 240, 480).minutes).toBe(240);
    });
  });

  describe('a job with a roster, on a day with no shift', () => {
    it('counts the whole session', () => {
      expect(svc.decide(true, 0, 480).minutes).toBe(480);
    });

    it('is still zero when nothing was worked', () => {
      expect(svc.decide(true, 0, 0).minutes).toBe(0);
    });
  });

  describe('a free job', () => {
    it('never produces overtime, however long the session', () => {
      expect(svc.decide(false, 0, 900).minutes).toBe(0);
      expect(svc.decide(false, 480, 900).minutes).toBe(0);
    });
  });

  it('needs approval only when there is overtime', () => {
    expect(svc.decide(true, 480, 540).status).toBe('PENDING');
    expect(svc.decide(true, 480, 480).status).toBeNull();
    expect(svc.decide(false, 0, 900).status).toBeNull();
    expect(svc.decide(true, 0, 480).status).toBe('PENDING');
  });

  it('records the worked total it was computed from', () => {
    // Without this a later correction to the times cannot be detected, and
    // the frozen figure would silently disagree with the record.
    expect(svc.decide(true, 480, 545).basisMinutes).toBe(545);
  });

  it('treats missing or negative worked time as zero', () => {
    expect(svc.decide(true, 480, undefined as any)).toEqual({ minutes: 0, basisMinutes: 0, status: null });
    expect(svc.decide(true, 480, -30).minutes).toBe(0);
  });
});
