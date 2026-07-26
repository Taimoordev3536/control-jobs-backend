import { SessionWatchdogService } from './session-watchdog.service';
import { SessionReviewStatus } from '../entities/work-session.entity';
import { POLICY_DEFAULTS } from '../../attendance-policy/attendance-policy.service';

const svc = new SessionWatchdogService(
  {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
);

const D = (h: number, m = 0, day = 27) => new Date(2026, 6, day, h, m);
const policy = (over: Partial<ReturnType<typeof POLICY_DEFAULTS>> = {}) => ({ ...POLICY_DEFAULTS(), ...over });

const decide = (o: any) =>
  svc.decide({ workerNotified: false, employerNotified: false, ...o });

describe('watchdog — scheduled job, extra hours ON', () => {
  const base = { checkIn: D(9), shiftEnd: D(17), policy: policy({ extraHoursAllowed: true }) };

  it('does nothing before the shift ends', () => {
    expect(decide({ ...base, now: D(16) }).kind).toBe('none');
  });

  it('does nothing in the first half hour after', () => {
    expect(decide({ ...base, now: D(17, 20) }).kind).toBe('none');
  });

  it('reminds the worker at +30 min', () => {
    expect(decide({ ...base, now: D(17, 35) }).kind).toBe('notify-worker');
  });

  it('does not remind the worker twice', () => {
    expect(decide({ ...base, now: D(18), workerNotified: true }).kind).toBe('none');
  });

  it('tells the employer at +2h', () => {
    expect(decide({ ...base, now: D(19, 5), workerNotified: true }).kind).toBe('notify-employer');
  });

  it('closes at +4h, recording the shift end', () => {
    const a: any = decide({ ...base, now: D(21, 5), workerNotified: true, employerNotified: true });
    expect(a.kind).toBe('close');
    expect(a.at).toEqual(D(17));                       // not 21:05
    expect(a.status).toBe(SessionReviewStatus.NEEDS_CONFIRMATION);
    expect(a.recordHours).toBe(true);
  });

  it('honours a longer wait from the policy', () => {
    const p = policy({ extraHoursAllowed: true, extraHoursWaitMins: 8 * 60 });
    expect(decide({ ...base, policy: p, now: D(21, 5) }).kind).not.toBe('close');
    expect(decide({ ...base, policy: p, now: D(1, 5, 28) }).kind).toBe('close');
  });
});

describe('watchdog — scheduled job, extra hours OFF', () => {
  const base = { checkIn: D(9), shiftEnd: D(17), policy: policy({ extraHoursAllowed: false }) };

  it('reminds the worker quickly', () => {
    expect(decide({ ...base, now: D(17, 16) }).kind).toBe('notify-worker');
  });

  it('closes 30 minutes after the shift', () => {
    const a: any = decide({ ...base, now: D(17, 31), workerNotified: true });
    expect(a.kind).toBe('close');
    expect(a.at).toEqual(D(17));
  });

  it('never waits the extra-hours window', () => {
    expect(decide({ ...base, now: D(18) }).kind).toBe('close');
  });
});

describe('watchdog — a legitimately long shift is not disturbed', () => {
  it('leaves a 27h Tue 11:00 -> Wed 14:00 shift alone until its own end', () => {
    const p = policy({ extraHoursAllowed: true });
    const shiftEnd = D(14, 0, 28); // Wednesday 14:00
    expect(decide({ checkIn: D(11), shiftEnd, policy: p, now: D(23, 0, 27) }).kind).toBe('none');
    expect(decide({ checkIn: D(11), shiftEnd, policy: p, now: D(9, 0, 28) }).kind).toBe('none');
    expect(decide({ checkIn: D(11), shiftEnd, policy: p, now: D(18, 5, 28) }).kind).toBe('close');
  });
});

describe('watchdog — free job', () => {
  const base = { checkIn: D(8), shiftEnd: null, policy: policy() };

  it('says nothing for the first ten hours', () => {
    expect(decide({ ...base, now: D(17) }).kind).toBe('none');
  });

  it('reminds the worker at 10h', () => {
    expect(decide({ ...base, now: D(18, 5) }).kind).toBe('notify-worker');
  });

  it('tells the employer at 12h', () => {
    expect(decide({ ...base, now: D(20, 5), workerNotified: true }).kind).toBe('notify-employer');
  });

  it('closes at 14h without inventing hours', () => {
    const a: any = decide({ ...base, now: D(22, 5), workerNotified: true, employerNotified: true });
    expect(a.kind).toBe('close');
    expect(a.status).toBe(SessionReviewStatus.NEEDS_TIME);
    expect(a.recordHours).toBe(false);
  });

  it('follows the employer own numbers', () => {
    const p = policy({ freeCloseAfterMins: 24 * 60, freeNotifyWorkerMins: 20 * 60, freeNotifyEmployerMins: 22 * 60 });
    expect(decide({ ...base, policy: p, now: D(22) }).kind).toBe('none');
    expect(decide({ ...base, policy: p, now: D(8, 5, 28) }).kind).toBe('close');
  });
});

describe('watchdog — recordScheduledEnd off', () => {
  it('records the moment of closing instead', () => {
    const p = policy({ extraHoursAllowed: false, recordScheduledEnd: false });
    const a: any = decide({ checkIn: D(9), shiftEnd: D(17), policy: p, now: D(17, 45) });
    expect(a.at).toEqual(D(17, 45));
  });
});
