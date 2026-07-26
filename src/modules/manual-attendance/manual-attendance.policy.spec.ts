/**
 * Phase B: policy resolution and the duration rule.
 */
import { BadRequestException } from '@nestjs/common';
import {
  ManualAttendanceService,
  MANUAL_ATTENDANCE_DEFAULTS,
  MANUAL_ATTENDANCE_FIELDS,
} from './manual-attendance.service';

const JOB = { id: 1, publicId: 'j', employer: { id: 10 }, client: { id: 20 }, workers: [] };

function build(rows: any[] = []) {
  const permissionRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const key = Object.keys(where)[0];
      return rows.find((r) => r[key] === where[key]) ?? null;
    }),
    create: jest.fn((v) => ({ ...v })),
    save: jest.fn(async (v) => v),
  };
  const jobRepo = { findOne: jest.fn(async () => JOB) };
  const userRepo = { findOne: jest.fn(async () => ({ id: 99, role: { value: 1 } })) }; // admin
  const workSessionRepo = { findOne: jest.fn(async () => null) };
  const svc = new ManualAttendanceService(
    {} as any, permissionRepo as any, jobRepo as any, {} as any, {} as any,
    workSessionRepo as any, {} as any, {} as any, {} as any, {} as any,
    userRepo as any, {} as any, {} as any,
  );
  return { svc, permissionRepo };
}

describe('permission resolution', () => {
  it('is enabled when nothing is configured', async () => {
    const { svc } = build();
    const eff = await svc.getEffectivePermissions(1);
    expect(eff!.isEnabled).toBe(true);
    expect(eff!.maxRetroactiveDays).toBe(7);
  });

  it('merges a job row over the employer row instead of replacing it', async () => {
    // Employer allows 14 retroactive days; the job row only narrows the monthly cap.
    const { svc } = build([
      { employerId: 10, isEnabled: true, maxRetroactiveDays: 14, maxRequestsPerWorkerMonth: 10, workerCanRequest: true, employerCanCreate: true, clientCanCreate: true, requireReason: true },
      { jobId: 1, maxRequestsPerWorkerMonth: 3 },
    ]);
    const eff = await svc.getEffectivePermissions(1);
    expect(eff!.maxRequestsPerWorkerMonth).toBe(3);  // job wins
    expect(eff!.maxRetroactiveDays).toBe(14);        // employer survives
    expect(eff!.isEnabled).toBe(true);               // not reset to the column default
  });

  it('lets the most specific level win', async () => {
    const { svc } = build([
      { employerId: 10, isEnabled: true },
      { clientId: 20, isEnabled: true, requireReason: false },
      { jobId: 1, isEnabled: false },
    ]);
    const eff = await svc.getEffectivePermissions(1);
    expect(eff!.isEnabled).toBe(false);   // job
    expect(eff!.requireReason).toBe(false); // client
  });

  it('ignores null fields on a layer', async () => {
    const { svc } = build([
      { employerId: 10, maxRetroactiveDays: 30 },
      { jobId: 1, maxRetroactiveDays: null },
    ]);
    expect((await svc.getEffectivePermissions(1))!.maxRetroactiveDays).toBe(30);
  });
});

describe('new permission rows', () => {
  it('start from the defaults, so a partial save cannot disable the feature', async () => {
    const { svc, permissionRepo } = build();
    // Saving only the retroactive window used to write is_enabled = false.
    const saved: any = await svc.upsertPermissionForJob(
      '1', { maxRetroactiveDays: 14 } as any, { id: 99 },
    );
    expect(saved.maxRetroactiveDays).toBe(14);
    expect(saved.isEnabled).toBe(true);
    expect(permissionRepo.save).toHaveBeenCalled();
  });
});

describe('defaults', () => {
  it('cover every field the merge knows about', () => {
    const d: any = MANUAL_ATTENDANCE_DEFAULTS();
    for (const f of MANUAL_ATTENDANCE_FIELDS) {
      expect(d[f]).toBeDefined();
    }
  });
});

describe('duration rule', () => {
  const svc: any = build().svc;
  const at = (h: number, d = 1) => new Date(2026, 6, d, h, 0, 0);

  it('accepts a normal day', () => {
    expect(() => svc.assertSpanWithinLimit(at(9), at(17))).not.toThrow();
  });

  it('accepts exactly 24 hours', () => {
    expect(() => svc.assertSpanWithinLimit(at(9, 1), at(9, 2))).not.toThrow();
  });

  it('rejects more than 24 hours', () => {
    expect(() => svc.assertSpanWithinLimit(at(9, 1), at(10, 2)))
      .toThrow(BadRequestException);
  });

  it('rejects a check-out before the check-in', () => {
    expect(() => svc.assertSpanWithinLimit(at(17), at(9))).toThrow(BadRequestException);
  });

  it('does nothing when a time is missing', () => {
    expect(() => svc.assertSpanWithinLimit(at(9), null)).not.toThrow();
    expect(() => svc.assertSpanWithinLimit(null, at(17))).not.toThrow();
  });

  it('rejects the multi-day spans that reached production', () => {
    // 121h and 99h records both arrived through CHECK_OUT_ONLY.
    const checkIn = new Date(2026, 6, 1, 8, 0);
    expect(() => svc.assertSpanWithinLimit(checkIn, new Date(2026, 6, 6, 9, 0)))
      .toThrow(BadRequestException);
    expect(() => svc.assertSpanWithinLimit(checkIn, new Date(2026, 6, 5, 11, 0)))
      .toThrow(BadRequestException);
  });
});

/**
 * Overlap, not "same day". Job 28 in production really does run three shifts
 * on one Monday: 02:00-03:00, 05:00-07:00, 09:00-12:00.
 */
describe('overlap detection', () => {
  const overlaps = (aStart: Date, aEnd: Date | null, bStart: Date, bEnd: Date) =>
    aStart < bEnd && (aEnd === null || aEnd > bStart);
  const t = (h: number, m = 0) => new Date(2026, 6, 27, h, m);

  it('allows a second shift later the same day', () => {
    expect(overlaps(t(2), t(3), t(5), t(7))).toBe(false);
    expect(overlaps(t(5), t(7), t(9), t(12))).toBe(false);
  });

  it('allows back-to-back shifts that touch', () => {
    expect(overlaps(t(9), t(13), t(13), t(17))).toBe(false);
  });

  it('blocks a genuine overlap', () => {
    expect(overlaps(t(9), t(13), t(11), t(15))).toBe(true);
  });

  it('blocks anything after an open session started', () => {
    expect(overlaps(t(9), null, t(14), t(18))).toBe(true);
  });

  it('allows a shift that ended before an open one began', () => {
    expect(overlaps(t(14), null, t(9), t(12))).toBe(false);
  });
});
