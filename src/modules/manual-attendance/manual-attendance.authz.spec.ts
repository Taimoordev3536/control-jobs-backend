/**
 * Authorization tests for manual attendance.
 *
 * Each case below was an open hole: the endpoints checked that you were logged
 * in, and sometimes what role you had, but never whether the job was yours.
 *
 * Company A = employer 1 (user 10), its job 100, its worker 50.
 * Company B = employer 2 (user 20) — entirely unrelated.
 */
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ManualAttendanceService } from './manual-attendance.service';
import { SubUserPermission } from '../auth/enums/sub-user-permission.enum';
import { UserRole } from '../auth/enums/user-role.enum';

const JOB_A_UUID = '11111111-1111-4111-8111-111111111111';
const JOB_A = { id: 100, publicId: JOB_A_UUID, employer: { id: 1 }, client: { id: 7 }, workers: [{ id: 50 }] };

const USERS: Record<number, { id: number; role: { value: UserRole } }> = {
  10: { id: 10, role: { value: UserRole.Employer } }, // company A owner
  20: { id: 20, role: { value: UserRole.Employer } }, // company B owner
  30: { id: 30, role: { value: UserRole.Client } },   // client of company A
  40: { id: 40, role: { value: UserRole.Client } },   // unrelated client
  50: { id: 50, role: { value: UserRole.Worker } },   // worker on job A
  60: { id: 60, role: { value: UserRole.Worker } },   // unrelated worker
  99: { id: 99, role: { value: UserRole.Admin } },
};
const EMPLOYER_OF_USER: Record<number, number> = { 10: 1, 20: 2 };
const CLIENT_OF_USER: Record<number, number> = { 30: 7, 40: 8 };
const WORKER_OF_USER: Record<number, number> = { 50: 50, 60: 60 };

function build() {
  const permissionRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((v) => ({ ...v })),
    save: jest.fn(async (v) => v),
  };
  const requestRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 1, publicId: 'req-1', jobId: JOB_A.id, status: 'PENDING', requestedByUserId: 50,
      job: JOB_A, worker: { id: 50 },
    }),
    createQueryBuilder: jest.fn(),
  };
  const jobRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      where?.id === JOB_A.id || where?.publicId === JOB_A_UUID ? JOB_A : null),
  };
  const userRepo = { findOne: jest.fn(async ({ where }: any) => USERS[where.id] ?? null) };
  const employerUserRepo = {
    findOne: jest.fn(async ({ where }: any) => {
      const uid = where?.user?.id;
      return EMPLOYER_OF_USER[uid] ? { employer: { id: EMPLOYER_OF_USER[uid] } } : null;
    }),
  };
  const clientUserRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      CLIENT_OF_USER[where.userId] ? { client: { id: CLIENT_OF_USER[where.userId] } } : null),
  };
  const workerUserRepo = {
    findOne: jest.fn(async ({ where }: any) =>
      WORKER_OF_USER[where.userId] ? { worker: { id: WORKER_OF_USER[where.userId] } } : null),
  };

  const svc = new ManualAttendanceService(
    requestRepo as any, permissionRepo as any, jobRepo as any,
    {} as any, {} as any, {} as any, {} as any,
    employerUserRepo as any, workerUserRepo as any, clientUserRepo as any,
    userRepo as any, {} as any, { createAndEmitAlert: jest.fn() } as any,
  );
  return { svc, permissionRepo, requestRepo };
}

const owner = (id: number) => ({ id });
const editSub = (id: number) => ({ id, subUser: { isSubUser: true, permission: SubUserPermission.EDIT } });
const adminSub = (id: number) => ({ id, subUser: { isSubUser: true, permission: SubUserPermission.ADMIN } });

describe('manual attendance authorization', () => {
  // ── Job-level settings ──────────────────────────────────────────────
  describe('PUT permissions/job/:jobId', () => {
    it('lets the owning employer change the settings', async () => {
      const { svc } = build();
      await expect(svc.upsertPermissionForJob(JOB_A_UUID, { isEnabled: true } as any, owner(10)))
        .resolves.toBeDefined();
    });

    it('blocks an employer from another company', async () => {
      const { svc } = build();
      await expect(svc.upsertPermissionForJob(JOB_A_UUID, { isEnabled: false } as any, owner(20)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks a worker on the job', async () => {
      const { svc } = build();
      await expect(svc.upsertPermissionForJob(JOB_A_UUID, { isEnabled: false } as any, owner(50)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks an unrelated worker', async () => {
      const { svc } = build();
      await expect(svc.upsertPermissionForJob(JOB_A_UUID, { isEnabled: false } as any, owner(60)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks an EDIT sub-user of the owning employer', async () => {
      const { svc } = build();
      await expect(svc.upsertPermissionForJob(JOB_A_UUID, { isEnabled: false } as any, editSub(10)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows an ADMIN sub-user of the owning employer', async () => {
      const { svc } = build();
      await expect(svc.upsertPermissionForJob(JOB_A_UUID, { isEnabled: true } as any, adminSub(10)))
        .resolves.toBeDefined();
    });
  });

  // ── Reading one request ─────────────────────────────────────────────
  describe('POST requests — creating attendance', () => {
    // This was the widest hole of the lot: creation checked the caller's role
    // and that the worker was on the job, but never that the job was theirs.
    // Through direct entry, which self-approves, company B could write and
    // approve attendance for company A's worker.
    it("refuses another company's job", async () => {
      const { svc } = build();
      await expect(
        svc.createRequest(
          { jobId: JOB_A_UUID, workerId: 'w', requestType: 'CREATE_NEW' } as any,
          20,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("refuses another company's job on direct entry too", async () => {
      const { svc } = build();
      await expect(
        svc.directCreateAttendance(
          { jobId: JOB_A_UUID, workerId: 'w', requestType: 'CREATE_NEW' } as any,
          20,
          owner(20),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses an unrelated client', async () => {
      const { svc } = build();
      await expect(
        svc.createRequest(
          { jobId: JOB_A_UUID, workerId: 'w', requestType: 'CREATE_NEW' } as any,
          40,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('gets past the ownership check for the owning employer', async () => {
      const { svc } = build();
      // It fails later, on the worker lookup this harness does not stub —
      // what matters is that it is no longer Forbidden.
      await expect(
        svc.createRequest(
          { jobId: JOB_A_UUID, workerId: 'w', requestType: 'CREATE_NEW' } as any,
          10,
        ),
      ).rejects.not.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('GET requests/:publicId', () => {
    it('lets the owning employer read it', async () => {
      const { svc } = build();
      await expect(svc.getRequestByPublicId('req-1', owner(10))).resolves.toBeDefined();
    });

    it('lets the worker it belongs to read it', async () => {
      const { svc } = build();
      await expect(svc.getRequestByPublicId('req-1', owner(50))).resolves.toBeDefined();
    });

    it("blocks another company's employer", async () => {
      const { svc } = build();
      await expect(svc.getRequestByPublicId('req-1', owner(20)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks an unrelated client', async () => {
      const { svc } = build();
      await expect(svc.getRequestByPublicId('req-1', owner(40)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── Reviewing ───────────────────────────────────────────────────────
  describe('PATCH requests/:publicId/review', () => {
    it("blocks another company's employer from approving", async () => {
      const { svc } = build();
      await expect(svc.reviewRequest('req-1', { action: 'REJECT' } as any, 20, owner(20)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('blocks an EDIT sub-user of the owning employer', async () => {
      const { svc } = build();
      await expect(svc.reviewRequest('req-1', { action: 'REJECT' } as any, 10, editSub(10)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('still blocks reviewing your own request', async () => {
      const { svc } = build();
      // user 50 raised it; they are a worker, so the role gate rejects first
      await expect(svc.reviewRequest('req-1', { action: 'APPROVE' } as any, 50, owner(50)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── Employer / client level settings ────────────────────────────────
  describe('employer and client settings', () => {
    it('blocks an EDIT sub-user from changing employer settings', async () => {
      const { svc } = build();
      await expect(svc.upsertPermissionForEmployer(10, { isEnabled: false } as any, editSub(10)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows the employer owner', async () => {
      const { svc } = build();
      await expect(svc.upsertPermissionForEmployer(10, { isEnabled: true } as any, owner(10)))
        .resolves.toBeDefined();
    });

    it('blocks an EDIT sub-user from changing client settings', async () => {
      const { svc } = build();
      await expect(svc.upsertPermissionForClient(30, { isEnabled: false } as any, editSub(30)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── Resolved permissions ────────────────────────────────────────────
  describe('GET permissions/job/:jobId/resolved', () => {
    it('lets a worker on the job read it (needed for the pre-flight check)', async () => {
      const { svc } = build();
      await expect(svc.getEffectivePermissionsByJobPublicId(JOB_A_UUID, owner(50)))
        .resolves.toBeDefined();
    });

    it("blocks another company's employer", async () => {
      const { svc } = build();
      await expect(svc.getEffectivePermissionsByJobPublicId(JOB_A_UUID, owner(20)))
        .rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ── Admin ───────────────────────────────────────────────────────────
  it('an admin is party to every job', async () => {
    const { svc } = build();
    await expect(svc.getRequestByPublicId('req-1', owner(99))).resolves.toBeDefined();
    await expect(svc.upsertPermissionForJob(JOB_A_UUID, { isEnabled: true } as any, owner(99)))
      .resolves.toBeDefined();
  });
});
