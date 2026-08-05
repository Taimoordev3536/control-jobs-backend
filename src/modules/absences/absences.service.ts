import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AbsenceRequest } from './entities/absence-request.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { AlertsService } from '../realtime/alerts.service';
import { AttendancePolicyService } from '../attendance-policy/attendance-policy.service';
import { countAbsenceDays, VacationCountMode } from './vacation-days';
import { DataSource } from 'typeorm';

@Injectable()
export class AbsencesService {
  constructor(
    @InjectRepository(AbsenceRequest) private absenceRepo: Repository<AbsenceRequest>,
    @InjectRepository(EmployerUser) private employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(EmployerWorker) private employerWorkerRepo: Repository<EmployerWorker>,
    @InjectRepository(WorkerUser) private workerUserRepo: Repository<WorkerUser>,
    private readonly alerts: AlertsService,
    private readonly policies: AttendancePolicyService,
    private readonly dataSource: DataSource,
  ) {}

  /** The company's public holidays for a year, as YYYY-MM-DD. */
  private async holidaysFor(employerId: number, year: number): Promise<Set<string>> {
    const rows = await this.dataSource.query(
      `SELECT to_char(date, 'YYYY-MM-DD') AS d FROM cjobs_employer_holidays
        WHERE employer_id = $1 AND EXTRACT(YEAR FROM date) IN ($2::int, $2::int + 1)`,
      [employerId, year],
    );
    return new Set(rows.map((r: any) => r.d));
  }

  private async vacationRules(employerId: number, workerId: number) {
    const policy = await this.policies.resolveForWorker(employerId, workerId);
    return {
      daysPerYear: policy.vacationDaysPerYear,
      mode: (policy.vacationCountMode || 'WORKING') as VacationCountMode,
    };
  }

  /** Days an absence uses, against the company's own calendar and mode. */
  async daysForAbsence(a: { employerId: number; workerId: number; startDate: string; endDate: string }) {
    const { mode } = await this.vacationRules(a.employerId, a.workerId);
    const year = Number(String(a.startDate).slice(0, 4));
    const holidays = mode === 'WORKING' ? await this.holidaysFor(a.employerId, year) : new Set<string>();
    return countAbsenceDays(a.startDate, a.endDate, mode, holidays);
  }

  /**
   * A worker's holiday for a calendar year: what they are entitled to, what
   * approved requests have used, and what is left.
   */
  async balance(workerId: number, employerId: number, year: number) {
    const { daysPerYear, mode } = await this.vacationRules(employerId, workerId);
    const [row] = await this.dataSource.query(
      `SELECT COALESCE(SUM(days_count), 0) AS used
         FROM cjobs_absence_requests
        WHERE worker_id = $1 AND status = 'approved' AND type = 'vacation'
          AND start_date >= make_date($2, 1, 1) AND start_date < make_date($2 + 1, 1, 1)`,
      [workerId, year],
    );
    const used = Math.round(Number(row?.used || 0) * 10) / 10;
    return {
      year,
      mode,
      entitledDays: daysPerYear,
      usedDays: used,
      remainingDays: Math.round((daysPerYear - used) * 10) / 10,
    };
  }

  /** One worker's balance, scoped to the employer asking. */
  async balanceForWorker(userId: number, workerPublicId: string, year?: number) {
    const employerId = await this.employerIdForUser(userId);
    const [w] = await this.dataSource.query(
      `SELECT w.id FROM workers w
        JOIN "employerWorkers" ew ON ew."workerId" = w.id
       WHERE w.public_id = $1 AND ew."employerId" = $2`,
      [workerPublicId, employerId],
    );
    if (!w) throw new NotFoundException('Worker not found');
    return this.balance(w.id, employerId, year || new Date().getFullYear());
  }

  /** The caller's own balance. */
  async myBalance(userId: number, year?: number) {
    const workerId = await this.workerIdForUser(userId);
    const link = await this.employerWorkerRepo.findOne({
      where: { worker: { id: workerId } },
      relations: ['employer'],
    });
    if (!link?.employer?.id) throw new BadRequestException('This worker is not linked to an employer');
    return this.balance(workerId, link.employer.id, year || new Date().getFullYear());
  }

  private typeEs(type: string): string {
    return ({ vacation: 'Vacaciones', permit: 'Permiso', sick: 'Baja', other: 'Otro' } as Record<string, string>)[type] || type;
  }

  // The worker's name lives on the workers_users junction, NOT on worker.user_id
  // (that direct FK is unpopulated), so a.worker.user.name was always null and
  // every request showed the worker's code. Resolve names via the junction.
  private async resolveWorkerNames(workerIds: number[]): Promise<Map<number, string>> {
    const names = new Map<number, string>();
    if (!workerIds.length) return names;
    const links = await this.workerUserRepo.find({
      where: [...new Set(workerIds)].map((id) => ({ worker: { id } })),
      relations: ['user'],
    });
    for (const l of links) {
      if (l.workerId && l.user?.name) names.set(l.workerId, l.user.name);
    }
    return names;
  }

  private map(a: AbsenceRequest, nameByWorkerId?: Map<number, string>) {
    return {
      id: a.publicId,
      workerName:
        nameByWorkerId?.get(a.workerId) || a.worker?.user?.name || a.worker?.code || null,
      type: a.type,
      startDate: a.startDate,
      endDate: a.endDate,
      reason: a.reason,
      days: a.daysCount != null ? Number(a.daysCount) : null,
      workerPublicId: a.worker?.publicId ?? null,
      status: a.status,
      reviewerNotes: a.reviewerNotes,
      createdAt: a.createdAt,
    };
  }

  private async employerIdForUser(userId: number): Promise<number> {
    const link = await this.employerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['employer'] });
    if (!link?.employer?.id) throw new NotFoundException('Employer not found for this user');
    return link.employer.id;
  }

  private async workerIdForUser(userId: number): Promise<number> {
    const link = await this.workerUserRepo.findOne({ where: { user: { id: userId } }, relations: ['worker'] });
    if (!link?.worker?.id) throw new ForbiddenException('Not a worker');
    return link.worker.id;
  }

  async listForEmployer(userId: number, status?: string) {
    const employerId = await this.employerIdForUser(userId);
    const where: any = { employerId };
    if (status) where.status = status;
    const rows = await this.absenceRepo.find({ where, relations: ['worker', 'worker.user'], order: { createdAt: 'DESC' } });
    const names = await this.resolveWorkerNames(rows.map((a) => a.workerId));
    return rows.map((a) => this.map(a, names));
  }

  async review(userId: number, publicId: string, body: { status?: string; reviewerNotes?: string }) {
    const employerId = await this.employerIdForUser(userId);
    const a = await this.absenceRepo.findOne({ where: { publicId, employerId }, relations: ['worker', 'worker.user'] });
    if (!a) throw new NotFoundException('Absence request not found');
    if (!['approved', 'rejected', 'pending'].includes(body.status || '')) throw new BadRequestException('Invalid status');
    a.status = body.status as string;
    a.reviewerNotes = body.reviewerNotes || null;
    a.reviewedByUserId = userId;
    a.reviewedAt = new Date();
    await this.absenceRepo.save(a);

    // Notify the worker of the decision.
    if (body.status !== 'pending') {
      try {
        const workerUserId = a.worker?.user?.id;
        if (workerUserId) {
          await this.alerts.createAndEmitForUser({
            userId: workerUserId,
            role: 'WORKER',
            type: 'ABSENCE_REQUEST_REVIEWED',
            message: `Tu solicitud de ausencia (${this.typeEs(a.type)}) fue ${a.status === 'approved' ? 'aprobada' : 'rechazada'}`,
            meta: { absencePublicId: a.publicId, status: a.status },
          });
        }
      } catch {}
    }

    return this.map(a, await this.resolveWorkerNames([a.workerId]));
  }

  async createForWorker(userId: number, body: { type?: string; startDate?: string; endDate?: string; reason?: string }) {
    const workerId = await this.workerIdForUser(userId);
    if (!body.startDate || !body.endDate) throw new BadRequestException('startDate and endDate are required');
    if (body.endDate < body.startDate) throw new BadRequestException('endDate must be on or after startDate');

    const link = await this.employerWorkerRepo.findOne({ where: { worker: { id: workerId } }, relations: ['employer', 'worker', 'worker.user'] });
    const employerId = link?.employer?.id;
    if (!employerId) throw new BadRequestException('This worker is not linked to an employer');

    const rec = this.absenceRepo.create({
      workerId,
      employerId,
      type: body.type || 'vacation',
      startDate: body.startDate,
      endDate: body.endDate,
      reason: body.reason || null,
      status: 'pending',
      requestedByUserId: userId,
    });
    // Counted now and kept: the public holiday calendar can be edited later,
    // and last year's holiday must not move with it.
    rec.daysCount = String(
      await this.daysForAbsence({ employerId, workerId, startDate: body.startDate, endDate: body.endDate }),
    );
    const saved = await this.absenceRepo.save(rec);

    // Notify the employer about the new absence request.
    try {
      const empLink = await this.employerUserRepo.findOne({ where: { employer: { id: employerId } }, relations: ['user'] });
      const employerUserId = empLink?.user?.id;
      if (employerUserId) {
        const workerName =
          (await this.resolveWorkerNames([workerId])).get(workerId) ||
          link?.worker?.user?.name ||
          'Un trabajador';
        await this.alerts.createAndEmitForUser({
          userId: employerUserId,
          role: 'EMPLOYER',
          type: 'ABSENCE_REQUEST_CREATED',
          message: `Nueva solicitud de ausencia de ${workerName}: ${this.typeEs(saved.type)}`,
          meta: { absencePublicId: saved.publicId, absenceType: saved.type },
        });
      }
    } catch {}

    return this.map(saved, await this.resolveWorkerNames([saved.workerId]));
  }

  async listMine(userId: number) {
    const workerId = await this.workerIdForUser(userId);
    const rows = await this.absenceRepo.find({ where: { workerId }, relations: ['worker', 'worker.user'], order: { createdAt: 'DESC' } });
    const names = await this.resolveWorkerNames(rows.map((a) => a.workerId));
    return rows.map((a) => this.map(a, names));
  }
}
