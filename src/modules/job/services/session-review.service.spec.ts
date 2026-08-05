import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { SessionReviewService } from './session-review.service';
import { SessionReviewStatus } from '../entities/work-session.entity';
import { UserRole } from '../../auth/enums/user-role.enum';

/**
 * Who may settle an auto-closed session, and which sessions may be settled.
 *
 * Company A = employer 1 (user 10), its job 100, its worker 50, its client 7.
 */
const JOB = { id: 100, employer: { id: 1 }, client: { id: 7 } };

const USERS: Record<number, any> = {
  10: { id: 10, role: { value: UserRole.Employer } },
  20: { id: 20, role: { value: UserRole.Employer } }, // another company
  30: { id: 30, role: { value: UserRole.Client } },   // the client of job 100
  50: { id: 50, role: { value: UserRole.Worker } },   // the worker on it
  60: { id: 60, role: { value: UserRole.Worker } },   // someone else
  99: { id: 99, role: { value: UserRole.Admin } },
};

function build(session: any) {
  const sessionRepo = {
    findOne: jest.fn(async () => session),
    save: jest.fn(async (v: any) => v),
    createQueryBuilder: jest.fn(),
  };
  const svc = new SessionReviewService(
    sessionRepo as any,
    { update: jest.fn() } as any,
    { findOne: jest.fn(async () => JOB) } as any,
    { findOne: jest.fn(async ({ where }: any) => (where?.user?.id === 10 ? { employer: { id: 1 } } : where?.user?.id === 20 ? { employer: { id: 2 } } : null)) } as any,
    { findOne: jest.fn(async ({ where }: any) => (where?.userId === 50 ? { workerId: 50 } : where?.userId === 60 ? { workerId: 60 } : null)) } as any,
    { findOne: jest.fn(async ({ where }: any) => (where?.userId === 30 ? { clientId: 7 } : null)) } as any,
    { findOne: jest.fn(async ({ where }: any) => USERS[where.id] ?? null) } as any,
  );
  return { svc, sessionRepo };
}

const flagged = (over: any = {}) => ({
  id: 1,
  publicId: 'sess-1',
  jobId: JOB.id,
  workerId: 50,
  checkInTime: new Date('2026-07-06T06:00:00Z'),
  reviewStatus: SessionReviewStatus.NEEDS_CONFIRMATION,
  totalBreakMinutes: 0,
  ...over,
});

describe('SessionReviewService', () => {
  describe('who may settle', () => {
    it('lets the owning employer confirm', async () => {
      const { svc, sessionRepo } = build(flagged());
      await svc.confirm('sess-1', 10);
      expect(sessionRepo.save).toHaveBeenCalled();
    });

    it('lets the worker themself confirm', async () => {
      const { svc, sessionRepo } = build(flagged());
      await svc.confirm('sess-1', 50);
      expect(sessionRepo.save).toHaveBeenCalled();
    });

    it("refuses another company's employer", async () => {
      const { svc } = build(flagged());
      await expect(svc.confirm('sess-1', 20)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('refuses an unrelated worker', async () => {
      const { svc } = build(flagged());
      await expect(svc.confirm('sess-1', 60)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets the client see it but not settle it', async () => {
      // The employer carries the record in Spain, so a client closing someone
      // else's worker's day would put the liability in the wrong place.
      const { svc } = build(flagged());
      const seen = await svc.get('sess-1', 30);
      expect(seen.canSettle).toBe(false);
      await expect(svc.confirm('sess-1', 30)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('confirm', () => {
    it('refuses a session with no recorded end', async () => {
      const { svc } = build(flagged({ reviewStatus: SessionReviewStatus.NEEDS_TIME }));
      await expect(svc.confirm('sess-1', 10)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a session that was never flagged', async () => {
      const { svc } = build(flagged({ reviewStatus: null }));
      await expect(svc.confirm('sess-1', 10)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('correct', () => {
    const end = new Date('2026-07-06T14:00:00Z');

    it('accepts a real end time on a flagged session', async () => {
      const { svc, sessionRepo } = build(flagged({ reviewStatus: SessionReviewStatus.NEEDS_TIME }));
      await svc.correct('sess-1', 10, end);
      expect(sessionRepo.save).toHaveBeenCalled();
    });

    it('refuses a session that is not awaiting review', async () => {
      // Without this a worker could rewrite any of their own past records —
      // including ones already confirmed, paid and invoiced — bypassing the
      // manual attendance request flow entirely.
      const { svc } = build(flagged({ reviewStatus: SessionReviewStatus.CONFIRMED }));
      await expect(svc.correct('sess-1', 50, end)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses an unparseable time instead of saving NaN minutes', async () => {
      const { svc } = build(flagged({ reviewStatus: SessionReviewStatus.NEEDS_TIME }));
      await expect(svc.correct('sess-1', 10, new Date('nonsense'))).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses an end before the check-in', async () => {
      const { svc } = build(flagged({ reviewStatus: SessionReviewStatus.NEEDS_TIME }));
      await expect(
        svc.correct('sess-1', 10, new Date('2026-07-06T05:00:00Z')),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('refuses a session longer than a day', async () => {
      const { svc } = build(flagged({ reviewStatus: SessionReviewStatus.NEEDS_TIME }));
      await expect(
        svc.correct('sess-1', 10, new Date('2026-07-08T06:00:00Z')),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
