import { WorkersService } from './workers.service';

/**
 * The split that decides what a payslip pays.
 *
 * Every rule here was a bug at some point: rest-compensated hours were
 * dropped from pay entirely, un-swept sessions were billed as ordinary time
 * and then flagged afterwards, and the four buckets were rounded
 * independently so the parts did not add up to the whole.
 */
describe('billableSessions', () => {
  // billableSessions is pure apart from the manager it is handed; nothing it
  // touches is injected.
  const svc: any = new WorkersService(
    ...(Array(18).fill(null) as unknown as ConstructorParameters<typeof WorkersService>),
  );

  const call = (rows: any[]) =>
    svc.billableSessions({ query: async () => rows }, 1, '2026-07-01', '2026-07-31');

  const session = (o: Partial<Record<string, any>> = {}) => ({
    id: 1,
    total_work_minutes: 480,
    check_out_time: new Date(),
    overtime_basis_minutes: 480,
    overtime_minutes: 0,
    overtime_status: null,
    overtime_compensation: null,
    ...o,
  });

  it('is all ordinary when there is no overtime', async () => {
    const r = await call([session()]);
    expect([r.hours, r.ordinaryHours, r.paidOvertimeHours]).toEqual([8, 8, 0]);
  });

  it('splits overtime approved for pay out of ordinary hours', async () => {
    const r = await call([
      session({ total_work_minutes: 540, overtime_basis_minutes: 540, overtime_minutes: 60, overtime_status: 'APPROVED', overtime_compensation: 'PAID' }),
    ]);
    expect([r.hours, r.ordinaryHours, r.paidOvertimeHours]).toEqual([9, 8, 1]);
  });

  it('keeps rest-compensated overtime in ordinary pay', async () => {
    // The worker did the hours; compensating with rest forgoes the premium,
    // it does not make the day unpaid. A rest day is 100% overtime, so
    // removing it paid nothing at all for a day worked.
    const r = await call([
      session({ overtime_minutes: 480, overtime_status: 'APPROVED', overtime_compensation: 'TIME_OFF' }),
    ]);
    expect(r.ordinaryHours).toBe(8);
    expect(r.paidOvertimeHours).toBe(0);
    expect(r.restOvertimeHours).toBe(8);
  });

  it('counts an undecided session so issuing can be blocked', async () => {
    const r = await call([session({ overtime_minutes: 60, overtime_status: 'PENDING' })]);
    expect(r.pendingCount).toBe(1);
  });

  it('counts a session the sweep has not reached', async () => {
    // Billing it now would pay its overtime as ordinary time and then stamp
    // it PENDING — money gone at the wrong rate, and a queue entry nobody
    // can act on.
    const r = await call([session({ overtime_basis_minutes: null })]);
    expect(r.uncomputedCount).toBe(1);
  });

  it('treats a stale basis as unsettled', async () => {
    const r = await call([session({ total_work_minutes: 500, overtime_basis_minutes: 480 })]);
    expect(r.uncomputedCount).toBe(1);
  });

  it('leaves an open session alone', async () => {
    const r = await call([session({ check_out_time: null })]);
    expect(r.uncomputedCount).toBe(0);
  });

  it('rejected overtime falls back into ordinary hours', async () => {
    // Refusing to treat time as overtime does not make it unworked.
    const r = await call([
      session({ total_work_minutes: 540, overtime_basis_minutes: 540, overtime_minutes: 60, overtime_status: 'REJECTED' }),
    ]);
    expect(r.ordinaryHours).toBe(9);
    expect(r.paidOvertimeHours).toBe(0);
  });

  it('the parts add up to the whole', async () => {
    // 122 min with 1 min of paid overtime: rounding each bucket separately
    // gave 2,00 + 0,02 against 2,03 worked — money invented.
    const r = await call([
      session({ total_work_minutes: 122, overtime_basis_minutes: 122, overtime_minutes: 1, overtime_status: 'APPROVED', overtime_compensation: 'PAID' }),
    ]);
    expect(Math.round((r.ordinaryHours + r.paidOvertimeHours) * 100) / 100).toBe(r.hours);
  });

  it('sums several sessions', async () => {
    const r = await call([
      session({ id: 1, total_work_minutes: 480, overtime_basis_minutes: 480 }),
      session({ id: 2, total_work_minutes: 240, overtime_basis_minutes: 240 }),
    ]);
    expect(r.hours).toBe(12);
    expect(r.ids).toEqual([1, 2]);
  });
});
