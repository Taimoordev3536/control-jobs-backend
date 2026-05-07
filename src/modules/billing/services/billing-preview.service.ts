import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employer } from '../../employers/entities/employer.entity';
import { EmployerWorker } from '../../employers/entities/employer-worker.entity';
import { EmployerWorkCenter } from '../../employers/entities/employer-work-center.entity';
import { AdminConfig } from '../../admin/entities/admin-config.entity';
import { RatePlan } from '../entities/rate-plan.entity';
import { PricingService, PricingBreakdown } from './pricing.service';
import { RatePlanService } from './rate-plan.service';

export interface BillingPreviewResult {
  employerId: number;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  isProrated: boolean;
  proratedDays?: number;
  daysInMonth?: number;
  workCenterCount: number;
  workerCount: number;
  rates: {
    monthlyFixed: number;
    perWorkCenter: number;
    perWorker: number;
  };
  discountPct: number;
  vatPct: number;
  breakdown: PricingBreakdown;
  billingStatus: string;
  trialEndsAt: string | null;
  pendingChange: {
    effectiveAt: string;
    monthlyFixed: number;
    perWorkCenter: number;
    perWorker: number;
  } | null;
}

@Injectable()
export class BillingPreviewService {
  constructor(
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    @InjectRepository(EmployerWorker)
    private readonly employerWorkerRepo: Repository<EmployerWorker>,
    @InjectRepository(EmployerWorkCenter)
    private readonly employerWorkCenterRepo: Repository<EmployerWorkCenter>,
    @InjectRepository(AdminConfig)
    private readonly adminConfigRepo: Repository<AdminConfig>,
    @InjectRepository(RatePlan)
    private readonly ratePlanRepo: Repository<RatePlan>,
    private readonly pricing: PricingService,
    private readonly ratePlanService: RatePlanService,
  ) {}

  /**
   * Compute the would-be invoice for the *current calendar month* without
   * persisting anything. Used by the Facturación tab to show a live total.
   */
  async previewCurrentMonth(employerId: number): Promise<BillingPreviewResult> {
    const employer = await this.employerRepo.findOne({ where: { id: employerId } });
    if (!employer) throw new NotFoundException(`Employer ${employerId} not found`);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    const periodStart = new Date(year, month, 1);
    const periodEnd = new Date(year, month + 1, 0); // last day of this month
    const daysInMonth = periodEnd.getDate();

    // Counts of active relations (employer linked via ManyToOne — query through relation)
    const [workerCount, workCenterCount] = await Promise.all([
      this.employerWorkerRepo.count({
        where: { employer: { id: employerId }, isActive: true },
      }),
      this.employerWorkCenterRepo.count({
        where: { employer: { id: employerId }, isActive: true },
      }),
    ]);

    // VAT rate from singleton admin_config (if absent, default 0)
    const adminConfig = await this.adminConfigRepo.find({ take: 1 });
    const vatPct = adminConfig.length ? Number(adminConfig[0].vatRate) || 0 : 0;

    // Live rates from the employer's rate plan. The 3 snapshot columns on
    // the employer (monthlyFixedRate / perWorkCenterRate / perWorkerRate)
    // are kept for rollback only and are NOT read for billing.
    const ratePlan = employer.ratePlanId
      ? await this.ratePlanRepo.findOne({ where: { id: employer.ratePlanId } })
      : null;
    const rates = ratePlan
      ? this.ratePlanService.getEffectiveRates(ratePlan)
      : { monthlyFixed: 0, perWorkCenter: 0, perWorker: 0 };

    // Proration: only if the employer's billing-effective start is mid-month.
    // Priority order matches the cron-side logic — `paymentMethodAddedAt`
    // (the reactivation date the employer added their card after trial)
    // wins over the trial-end date so we don't bill for the limbo days
    // between trial-end and card-add. Falls back to `trialEndsAt` for
    // legacy data, then `createdAt` for brand-new employers.
    let proratedDays = daysInMonth;
    let isProrated = false;
    const effectiveStartCandidate = employer.paymentMethodAddedAt
      ? new Date(employer.paymentMethodAddedAt)
      : employer.trialEndsAt
        ? new Date(employer.trialEndsAt)
        : new Date(employer.createdAt);
    if (
      effectiveStartCandidate > periodStart &&
      effectiveStartCandidate <= periodEnd
    ) {
      const startDay = effectiveStartCandidate.getDate();
      proratedDays = daysInMonth - startDay + 1;
      isProrated = proratedDays !== daysInMonth;
    }

    const breakdown = this.pricing.calculate({
      monthlyFixed: rates.monthlyFixed,
      perWorkCenter: rates.perWorkCenter,
      perWorker: rates.perWorker,
      workCenters: workCenterCount,
      workers: workerCount,
      discountPct: Number(employer.discount) || 0,
      vatPct,
      proratedDays: isProrated ? proratedDays : undefined,
      daysInMonth: isProrated ? daysInMonth : undefined,
    });

    const pendingChange =
      ratePlan?.pendingEffectiveAt && ratePlan.pendingEffectiveAt.getTime() > Date.now()
        ? {
            effectiveAt: toIsoDate(new Date(ratePlan.pendingEffectiveAt)),
            monthlyFixed: Number(ratePlan.pendingMonthlyFixed),
            perWorkCenter: Number(ratePlan.pendingPerWorkCenter),
            perWorker: Number(ratePlan.pendingPerWorker),
          }
        : null;

    return {
      employerId: employer.id,
      periodStart: toIsoDate(periodStart),
      periodEnd: toIsoDate(periodEnd),
      isProrated,
      proratedDays: isProrated ? proratedDays : undefined,
      daysInMonth: isProrated ? daysInMonth : undefined,
      workCenterCount,
      workerCount,
      rates,
      discountPct: Number(employer.discount) || 0,
      vatPct,
      breakdown,
      billingStatus: employer.billingStatus || 'ACTIVE',
      trialEndsAt: employer.trialEndsAt ? toIsoDate(new Date(employer.trialEndsAt)) : null,
      pendingChange,
    } as any;
  }
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
