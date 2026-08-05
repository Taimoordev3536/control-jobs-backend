import { RatePlanService } from './rate-plan.service';

/**
 * An invoice is priced by the period it covers, not the day it is printed.
 *
 * The monthly cron runs at 00:01 on the 1st, so pricing at "today" charged
 * the month just ended at the tariff that had just taken effect — and the
 * admin's preview, which already used periodStart, disagreed with what was
 * actually issued.
 */
describe('rate plan pricing date', () => {
  // getEffectiveRates is pure; nothing it touches is injected.
  const svc = new RatePlanService(
    ...(Array(9).fill(null) as [any, any, any, any, any, any, any, any, any]),
  );

  const plan: any = {
    monthlyFixed: 10,
    perWorkCenter: 2,
    perWorker: 1,
    pendingMonthlyFixed: 99,
    pendingPerWorkCenter: 9,
    pendingPerWorker: 9,
    pendingEffectiveAt: new Date('2026-02-01T00:00:00Z'),
  };

  it('charges the period, not the issue date', () => {
    expect(svc.getEffectiveRates(plan, new Date('2026-01-01T00:00:00Z')).monthlyFixed).toBe(10);
  });

  it('would have charged the new tariff if priced at the issue date', () => {
    expect(svc.getEffectiveRates(plan, new Date('2026-02-01T00:01:00Z')).monthlyFixed).toBe(99);
  });

  it('applies the new tariff from the moment it takes effect', () => {
    expect(svc.getEffectiveRates(plan, new Date('2026-02-15T12:00:00Z')).perWorker).toBe(9);
  });

  it('ignores a pending change that has not arrived', () => {
    const r = svc.getEffectiveRates(plan, new Date('2026-01-31T23:59:00Z'));
    expect([r.monthlyFixed, r.perWorkCenter, r.perWorker]).toEqual([10, 2, 1]);
  });

  it('uses the live rates when nothing is pending', () => {
    const settled: any = { monthlyFixed: 5, perWorkCenter: 1, perWorker: 0.5, pendingEffectiveAt: null };
    expect(svc.getEffectiveRates(settled, new Date('2030-01-01T00:00:00Z')).monthlyFixed).toBe(5);
  });
});
