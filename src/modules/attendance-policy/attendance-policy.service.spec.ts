import { ForbiddenException } from '@nestjs/common';
import {
  AttendancePolicyService,
  POLICY_DEFAULTS,
  POLICY_FIELDS,
} from './attendance-policy.service';
import { SubUserPermission } from '../auth/enums/sub-user-permission.enum';
import { UserRole } from '../auth/enums/user-role.enum';

const JOB_UUID = '11111111-1111-4111-8111-111111111111';
const OTHER_UUID = '22222222-2222-4222-8222-222222222222';
const WORKER_UUID = '33333333-3333-4333-8333-333333333333';
const JOB = { id: 100, publicId: JOB_UUID, employer: { id: 1 } };
const OTHER_JOB = { id: 200, publicId: OTHER_UUID, employer: { id: 2 } };
const WORKER = { id: 50, publicId: WORKER_UUID, employerWorkers: [{ employer: { id: 1 } }] };

const USERS: Record<number, any> = {
  10: { id: 10, role: { value: UserRole.Employer } }, // owns employer 1
  20: { id: 20, role: { value: UserRole.Employer } }, // owns employer 2
  50: { id: 50, role: { value: UserRole.Worker } },
  99: { id: 99, role: { value: UserRole.Admin } },
};
const EMPLOYER_OF: Record<number, number> = { 10: 1, 20: 2 };

function build(rows: any[] = []) {
  const policyRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const key = Object.keys(where)[0];
      return rows.find((r) => r[key] === where[key]) ?? null;
    }),
    create: jest.fn((v) => ({ ...v })),
    save: jest.fn(async (v) => v),
    delete: jest.fn(async () => ({ affected: 1 })),
  };
  const jobRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      if (where.id === JOB.id || where.publicId === JOB.publicId) return JOB;
      if (where.id === OTHER_JOB.id || where.publicId === OTHER_JOB.publicId) return OTHER_JOB;
      return null;
    }),
  };
  const workerRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      where.id === WORKER.id || where.publicId === WORKER.publicId ? WORKER : null),
  };
  const employerUserRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const uid = where?.user?.id;
      return EMPLOYER_OF[uid] ? { employer: { id: EMPLOYER_OF[uid] } } : null;
    }),
  };
  const userRepo = { findOne: jest.fn(async ({ where }: any) => USERS[where.id] ?? null) };
  // employerWorkers is the real link between a worker and their employer.
  const employerWorkerRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      where?.worker?.id === WORKER.id && where?.employer?.id === 1 ? { id: 1 } : null),
  };

  const svc = new AttendancePolicyService(
    policyRepo as any, jobRepo as any, workerRepo as any,
    employerUserRepo as any, employerWorkerRepo as any, userRepo as any,
  );
  return { svc, policyRepo };
}

const owner = (id: number) => ({ id });
const editSub = (id: number) => ({ id, subUser: { isSubUser: true, permission: SubUserPermission.EDIT } });

describe('policy resolution', () => {
  it('uses the defaults when nothing is configured', async () => {
    const { svc } = build();
    const p = await svc.resolve(100);
    expect(p).toEqual(POLICY_DEFAULTS());
    expect(p.extraHoursAllowed).toBe(true);
    expect(p.freeCloseAfterMins).toBe(14 * 60);
  });

  it('applies the employer layer', async () => {
    const { svc } = build([{ employerId: 1, extraHoursAllowed: false, closeAfterShiftEndMins: 45 }]);
    const p = await svc.resolve(100);
    expect(p.extraHoursAllowed).toBe(false);
    expect(p.closeAfterShiftEndMins).toBe(45);
    expect(p.freeCloseAfterMins).toBe(14 * 60); // untouched
  });

  it('lets the job override only what it sets', async () => {
    const { svc } = build([
      { employerId: 1, extraHoursAllowed: true, extraHoursWaitMins: 240, earlyCheckinMins: 45 },
      { jobId: 100, extraHoursWaitMins: 360 },
    ]);
    const p = await svc.resolve(100);
    expect(p.extraHoursWaitMins).toBe(360); // job
    expect(p.earlyCheckinMins).toBe(45);    // employer survives
    expect(p.extraHoursAllowed).toBe(true);
  });

  it('lets the worker beat both for extra hours', async () => {
    const { svc } = build([
      { employerId: 1, extraHoursAllowed: true },
      { jobId: 100, extraHoursAllowed: true },
      { workerId: 50, extraHoursAllowed: false },
    ]);
    expect((await svc.resolve(100, 50)).extraHoursAllowed).toBe(false);
  });

  it('lets a worker be allowed where the company is not', async () => {
    const { svc } = build([
      { employerId: 1, extraHoursAllowed: false },
      { workerId: 50, extraHoursAllowed: true },
    ]);
    expect((await svc.resolve(100, 50)).extraHoursAllowed).toBe(true);
  });

  it('treats null as inherit, not as false', async () => {
    const { svc } = build([
      { employerId: 1, extraHoursAllowed: false, closeAfterShiftEndMins: 45 },
      { jobId: 100, extraHoursAllowed: null, closeAfterShiftEndMins: null },
    ]);
    const p = await svc.resolve(100);
    expect(p.extraHoursAllowed).toBe(false);
    expect(p.closeAfterShiftEndMins).toBe(45);
  });

  it('ignores a worker layer when no worker is given', async () => {
    const { svc } = build([{ workerId: 50, extraHoursAllowed: false }]);
    expect((await svc.resolve(100)).extraHoursAllowed).toBe(true);
  });

  it('has a default for every field', () => {
    const d: any = POLICY_DEFAULTS();
    for (const f of POLICY_FIELDS) expect(d[f]).toBeDefined();
  });
});

describe('writing rules', () => {
  it('stores only the fields that were sent', async () => {
    const { svc, policyRepo } = build();
    const saved: any = await svc.upsertForJob(JOB_UUID, { extraHoursWaitMins: 300 } as any, owner(10));
    expect(saved.extraHoursWaitMins).toBe(300);
    expect(saved.extraHoursAllowed).toBeUndefined(); // stays inheriting
    expect(policyRepo.save).toHaveBeenCalled();
  });

  it('clears an override back to inheriting', async () => {
    const { svc, policyRepo } = build([{ jobId: 100, extraHoursAllowed: false }]);
    await svc.clearForJob(JOB_UUID, owner(10));
    expect(policyRepo.delete).toHaveBeenCalledWith({ jobId: 100 });
  });
});

describe('who may change the rules', () => {
  it('allows the owning employer', async () => {
    const { svc } = build();
    await expect(svc.upsertForJob(JOB_UUID, { extraHoursAllowed: false } as any, owner(10)))
      .resolves.toBeDefined();
  });

  it("blocks another company's employer", async () => {
    const { svc } = build();
    await expect(svc.upsertForJob(JOB_UUID, { extraHoursAllowed: false } as any, owner(20)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks a worker', async () => {
    const { svc } = build();
    await expect(svc.upsertForJob(JOB_UUID, { extraHoursAllowed: false } as any, owner(50)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('blocks an EDIT sub-user', async () => {
    const { svc } = build();
    await expect(svc.upsertForEmployer({ extraHoursAllowed: false } as any, editSub(10)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows an admin', async () => {
    const { svc } = build();
    await expect(svc.upsertForJob(JOB_UUID, { extraHoursAllowed: false } as any, owner(99)))
      .resolves.toBeDefined();
  });

  it('blocks a worker override from an employer who does not employ them', async () => {
    const { svc } = build();
    await expect(svc.upsertForWorker(WORKER_UUID, { extraHoursAllowed: false } as any, owner(20)))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows the employing employer to override a worker', async () => {
    const { svc } = build();
    await expect(svc.upsertForWorker(WORKER_UUID, { extraHoursAllowed: false } as any, owner(10)))
      .resolves.toBeDefined();
  });
});
