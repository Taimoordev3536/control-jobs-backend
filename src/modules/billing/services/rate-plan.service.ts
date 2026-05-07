import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RatePlan } from '../entities/rate-plan.entity';
import { EmployerSubType } from '../../employers/entities/employer-sub-type.entity';
import { EmployerType } from '../../employers/entities/employer-type.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { PartnerUser } from '../../partners/entities/partner-user.entity';
import { EmailService } from '../../../common/services/email.service';
import { AlertsService } from '../../realtime/alerts.service';

export const RATE_NOTICE_DAYS = 30;

export interface EffectiveRates {
  monthlyFixed: number;
  perWorkCenter: number;
  perWorker: number;
}

@Injectable()
export class RatePlanService {
  private readonly logger = new Logger(RatePlanService.name);

  constructor(
    @InjectRepository(RatePlan)
    private readonly ratePlanRepo: Repository<RatePlan>,
    @InjectRepository(EmployerSubType)
    private readonly subTypeRepo: Repository<EmployerSubType>,
    @InjectRepository(EmployerType)
    private readonly typeRepo: Repository<EmployerType>,
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    @InjectRepository(EmployerUser)
    private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(PartnerUser)
    private readonly partnerUserRepo: Repository<PartnerUser>,
    private readonly email: EmailService,
    private readonly alerts: AlertsService,
  ) {}

  findAllActive(): Promise<RatePlan[]> {
    return this.ratePlanRepo.find({
      where: { isActive: true },
      order: { id: 'ASC' },
    });
  }

  findAll(): Promise<RatePlan[]> {
    return this.ratePlanRepo.find({ order: { id: 'ASC' } });
  }

  /**
   * Resolve the rate plan that matches a given (subTypeId, typeId) combination.
   * Returns null if no active plan matches — caller decides how to handle that.
   */
  async findMatch(subTypeId: number, typeId: number): Promise<RatePlan | null> {
    const [subType, type] = await Promise.all([
      this.subTypeRepo.findOne({ where: { id: subTypeId } }),
      this.typeRepo.findOne({ where: { id: typeId } }),
    ]);
    if (!subType || !type) return null;

    const plans = await this.findAllActive();
    return (
      plans.find(
        (p) =>
          p.tariffType === String(type.name) &&
          p.subTypes.split(',').includes(String(subType.name)),
      ) ?? null
    );
  }

  async findById(id: number): Promise<RatePlan> {
    const plan = await this.ratePlanRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException(`Rate plan ${id} not found`);
    return plan;
  }

  /**
   * The rates that should be billed RIGHT NOW. If a pending change has reached
   * its effective date, that wins; otherwise the current values do. Used by
   * the preview, invoice, and signup-estimate endpoints so they all agree on
   * what an employer pays today.
   */
  getEffectiveRates(plan: RatePlan, at: Date = new Date()): EffectiveRates {
    if (
      plan.pendingEffectiveAt &&
      plan.pendingMonthlyFixed != null &&
      plan.pendingPerWorkCenter != null &&
      plan.pendingPerWorker != null &&
      plan.pendingEffectiveAt.getTime() <= at.getTime()
    ) {
      return {
        monthlyFixed: Number(plan.pendingMonthlyFixed),
        perWorkCenter: Number(plan.pendingPerWorkCenter),
        perWorker: Number(plan.pendingPerWorker),
      };
    }
    return {
      monthlyFixed: Number(plan.monthlyFixed),
      perWorkCenter: Number(plan.perWorkCenter),
      perWorker: Number(plan.perWorker),
    };
  }

  /**
   * Schedule a price change. Per the EU non-binding-services rule, customers
   * must be given at least RATE_NOTICE_DAYS notice before any rate change
   * takes effect. This method NEVER mutates the live monthly_fixed /
   * per_workcenter / per_worker columns directly — it stages the new values
   * in the pending_* columns and stamps an effective date 30 days out.
   *
   * Calling this again before the effective date overwrites the staged
   * values AND restarts the 30-day clock — so each new change re-arms the
   * notice period.
   */
  async scheduleRateChange(
    id: number,
    next: { monthlyFixed?: number; perWorkCenter?: number; perWorker?: number },
  ): Promise<RatePlan> {
    const plan = await this.findById(id);

    const current = this.getEffectiveRates(plan);
    const target = {
      monthlyFixed: next.monthlyFixed ?? current.monthlyFixed,
      perWorkCenter: next.perWorkCenter ?? current.perWorkCenter,
      perWorker: next.perWorker ?? current.perWorker,
    };

    if (
      target.monthlyFixed === current.monthlyFixed &&
      target.perWorkCenter === current.perWorkCenter &&
      target.perWorker === current.perWorker
    ) {
      // No-op submit. Clear any prior pending state so the page reflects truth.
      plan.pendingMonthlyFixed = null;
      plan.pendingPerWorkCenter = null;
      plan.pendingPerWorker = null;
      plan.pendingEffectiveAt = null;
      plan.pendingNotifiedAt = null;
      return this.ratePlanRepo.save(plan);
    }

    plan.pendingMonthlyFixed = target.monthlyFixed;
    plan.pendingPerWorkCenter = target.perWorkCenter;
    plan.pendingPerWorker = target.perWorker;
    plan.pendingEffectiveAt = new Date(Date.now() + RATE_NOTICE_DAYS * 24 * 60 * 60 * 1000);
    plan.pendingNotifiedAt = null;
    return this.ratePlanRepo.save(plan);
  }

  async cancelPending(id: number): Promise<RatePlan> {
    const plan = await this.findById(id);
    if (plan.pendingEffectiveAt && plan.pendingEffectiveAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'Pending change has already taken effect; cannot cancel',
      );
    }
    plan.pendingMonthlyFixed = null;
    plan.pendingPerWorkCenter = null;
    plan.pendingPerWorker = null;
    plan.pendingEffectiveAt = null;
    plan.pendingNotifiedAt = null;
    return this.ratePlanRepo.save(plan);
  }

  async setActive(id: number, isActive: boolean): Promise<RatePlan> {
    const plan = await this.findById(id);
    plan.isActive = isActive;
    return this.ratePlanRepo.save(plan);
  }

  /**
   * Notify every active employer on this plan that a rate change has been
   * scheduled. Sends an email to the default user and pushes a bell alert
   * over WS. Called by the controller after scheduleRateChange.
   *
   * Stamps `pending_notified_at` so a follow-up call (e.g. admin re-saves
   * the same values) can be skipped if needed — currently we always re-send
   * since each save re-arms the 30-day clock with potentially new prices.
   */
  async notifyAffectedEmployers(
    planId: number,
    kind: 'SCHEDULED' | 'CANCELLED',
    previousLive?: { fixed: number; perWorkCenter: number; perWorker: number },
  ): Promise<number> {
    const plan = await this.findById(planId);
    const employers = await this.findActiveEmployersOnPlan(planId);
    if (employers.length === 0) return 0;

    const employerRecipients = await this.findEmployerRecipients(employers);
    const partnerRecipients = await this.findPartnerRecipients(employers);

    const effectiveDate = plan.pendingEffectiveAt
      ? this.formatDate(plan.pendingEffectiveAt)
      : null;
    const oldPrices = previousLive ?? {
      fixed: Number(plan.monthlyFixed),
      perWorkCenter: Number(plan.perWorkCenter),
      perWorker: Number(plan.perWorker),
    };
    const newPrices = {
      fixed: Number(plan.pendingMonthlyFixed ?? plan.monthlyFixed),
      perWorkCenter: Number(plan.pendingPerWorkCenter ?? plan.perWorkCenter),
      perWorker: Number(plan.pendingPerWorker ?? plan.perWorker),
    };

    for (const r of employerRecipients) {
      try {
        if (kind === 'SCHEDULED' && plan.pendingEffectiveAt && effectiveDate) {
          await this.email.sendRateChangeNotice({
            to: r.email,
            name: r.name,
            planLabel: plan.label,
            effectiveDate,
            oldPrices,
            newPrices,
          });
          await this.alerts.createAndEmitForUser({
            userId: r.userId,
            role: 'EMPLOYER',
            type: 'RATE_CHANGE_SCHEDULED',
            message: `Tu tarifa cambiará el ${effectiveDate}`,
            meta: { planId, planLabel: plan.label, effectiveDate },
          });
        } else if (kind === 'CANCELLED') {
          await this.email.sendRateChangeCancelled({
            to: r.email,
            name: r.name,
            planLabel: plan.label,
          });
          await this.alerts.createAndEmitForUser({
            userId: r.userId,
            role: 'EMPLOYER',
            type: 'RATE_CHANGE_CANCELLED',
            message: `El cambio de tarifa programado para ${plan.label} ha sido cancelado.`,
            meta: { planId, planLabel: plan.label },
          });
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to notify employer user ${r.userId} for plan ${planId}: ${err.message}`,
        );
      }
    }

    for (const p of partnerRecipients) {
      try {
        if (kind === 'SCHEDULED' && plan.pendingEffectiveAt && effectiveDate) {
          await this.email.sendRateChangeNotice({
            to: p.email,
            name: p.name,
            planLabel: `${plan.label} (${p.affectedCount} ${p.affectedCount === 1 ? 'empleador' : 'empleadores'})`,
            effectiveDate,
            oldPrices,
            newPrices,
          });
          await this.alerts.createAndEmitForUser({
            userId: p.userId,
            role: 'PARTNER',
            type: 'RATE_CHANGE_SCHEDULED',
            message: `La tarifa ${plan.label} cambiará el ${effectiveDate} (${p.affectedCount} de tus empleadores)`,
            meta: {
              planId,
              planLabel: plan.label,
              effectiveDate,
              affectedCount: p.affectedCount,
            },
          });
        } else if (kind === 'CANCELLED') {
          await this.email.sendRateChangeCancelled({
            to: p.email,
            name: p.name,
            planLabel: `${plan.label} (${p.affectedCount} ${p.affectedCount === 1 ? 'empleador' : 'empleadores'})`,
          });
          await this.alerts.createAndEmitForUser({
            userId: p.userId,
            role: 'PARTNER',
            type: 'RATE_CHANGE_CANCELLED',
            message: `El cambio de tarifa programado para ${plan.label} ha sido cancelado.`,
            meta: { planId, planLabel: plan.label, affectedCount: p.affectedCount },
          });
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to notify partner user ${p.userId} for plan ${planId}: ${err.message}`,
        );
      }
    }

    if (kind === 'SCHEDULED') {
      plan.pendingNotifiedAt = new Date();
      await this.ratePlanRepo.save(plan);
    }
    return employerRecipients.length + partnerRecipients.length;
  }

  private findActiveEmployersOnPlan(planId: number): Promise<Employer[]> {
    return this.employerRepo.find({
      where: {
        ratePlanId: planId,
        billingStatus: In(['ACTIVE', 'TRIAL', 'AWAITING_PAYMENT_METHOD']) as any,
      },
    });
  }

  private async findEmployerRecipients(
    employers: Employer[],
  ): Promise<Array<{ employerId: number; userId: number; email: string; name: string }>> {
    if (employers.length === 0) return [];
    const employerIds = employers.map((e) => e.id);
    const links = await this.employerUserRepo.find({
      where: { employer: { id: In(employerIds) }, isDefault: true },
      relations: ['employer', 'user'],
    });

    return links
      .filter((l) => l.user?.email)
      .map((l) => ({
        employerId: l.employer.id,
        userId: l.user.id,
        email: l.user.email,
        name:
          (l.user.name && String(l.user.name).trim()) ||
          [l.user.firstName, l.user.lastName].filter(Boolean).join(' ').trim() ||
          l.employer.name ||
          l.user.email,
      }));
  }

  /**
   * One row per affected partner (deduped). `affectedCount` is the number
   * of that partner's employers on this plan — so the email/alert can say
   * "5 of your employers" instead of pinging the partner once per employer.
   */
  private async findPartnerRecipients(
    employers: Employer[],
  ): Promise<Array<{ partnerId: number; userId: number; email: string; name: string; affectedCount: number }>> {
    const counts = new Map<number, number>();
    for (const e of employers) {
      if (!e.partnerId) continue;
      counts.set(e.partnerId, (counts.get(e.partnerId) ?? 0) + 1);
    }
    if (counts.size === 0) return [];

    const partnerIds = Array.from(counts.keys());
    const links = await this.partnerUserRepo.find({
      where: { partnerId: In(partnerIds), isDefault: true },
      relations: ['partner', 'user'],
    });

    return links
      .filter((l) => l.user?.email)
      .map((l) => ({
        partnerId: l.partnerId,
        userId: l.user.id,
        email: l.user.email,
        name:
          (l.user.name && String(l.user.name).trim()) ||
          [l.user.firstName, l.user.lastName].filter(Boolean).join(' ').trim() ||
          l.partner?.name ||
          l.user.email,
        affectedCount: counts.get(l.partnerId) ?? 0,
      }));
  }

  private formatDate(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  /**
   * Promote any plans whose pending change is now in effect: copy pending_*
   * into the live columns and clear the pending fields. Idempotent — safe to
   * run repeatedly. Called by the daily billing cron.
   */
  async promoteDuePending(at: Date = new Date()): Promise<number> {
    const due = await this.ratePlanRepo
      .createQueryBuilder('rp')
      .where('rp.pending_effective_at IS NOT NULL')
      .andWhere('rp.pending_effective_at <= :at', { at })
      .getMany();

    for (const plan of due) {
      if (plan.pendingMonthlyFixed != null) plan.monthlyFixed = Number(plan.pendingMonthlyFixed);
      if (plan.pendingPerWorkCenter != null) plan.perWorkCenter = Number(plan.pendingPerWorkCenter);
      if (plan.pendingPerWorker != null) plan.perWorker = Number(plan.pendingPerWorker);
      plan.pendingMonthlyFixed = null;
      plan.pendingPerWorkCenter = null;
      plan.pendingPerWorker = null;
      plan.pendingEffectiveAt = null;
      plan.pendingNotifiedAt = null;
      await this.ratePlanRepo.save(plan);
    }
    return due.length;
  }
}
