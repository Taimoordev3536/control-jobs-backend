import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Employer } from '../../employers/entities/employer.entity';
import { InvoiceService } from './invoice.service';
import { RatePlanService } from './rate-plan.service';

/**
 * Scheduled jobs for the billing system.
 *
 * GATED behind env var BILLING_CRON_ENABLED. If unset (or "false"), every
 * scheduled tick is a no-op. This lets the code ship without auto-generating
 * real financial records until the operator flips the flag.
 */
@Injectable()
export class BillingCronService {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    private readonly invoices: InvoiceService,
    private readonly ratePlans: RatePlanService,
  ) {}

  private get enabled(): boolean {
    return String(process.env.BILLING_CRON_ENABLED || '').toLowerCase() === 'true';
  }

  /**
   * Daily trial-end handler: every TRIAL employer whose trial has ended is
   * flipped to AWAITING_PAYMENT_METHOD. The system does NOT auto-issue an
   * invoice or auto-activate them — per spec §6, the employer must add a
   * payment method first. Until then, service is paused. The eventual
   * monthly cron will prorate the first real invoice from the date the
   * card was actually added (`paymentMethodAddedAt`).
   *
   * Runs at 04:00 every day.
   */
  @Cron('0 3 * * *', { name: 'billing-promote-rate-plans' })
  async promotePendingRatePlans() {
    if (!this.enabled) return;
    const promoted = await this.ratePlans.promoteDuePending();
    if (promoted > 0) {
      this.logger.log(`Promoted ${promoted} rate plan(s) from pending → live`);
    }
  }

  @Cron('0 4 * * *', { name: 'billing-promote-trials' })
  async promoteTrialsToActive() {
    if (!this.enabled) return;
    this.logger.log('🔄 Trial-end job starting');

    const now = new Date();
    const ended = await this.employerRepo.find({
      where: { billingStatus: 'TRIAL', trialEndsAt: LessThanOrEqual(now) as any },
    });
    this.logger.log(`Found ${ended.length} employers with ended trials`);

    for (const employer of ended) {
      try {
        await this.handleTrialEnd(employer);
      } catch (err: any) {
        this.logger.error(
          `Failed to handle trial end for employer ${employer.id}: ${err.message}`,
          err.stack,
        );
      }
    }
    this.logger.log('✅ Trial-end job done');
  }

  private async handleTrialEnd(employer: Employer) {
    if (employer.paymentMethodId) {
      employer.billingStatus = 'ACTIVE';
      if (!employer.paymentMethodAddedAt) {
        // Anchor to trial-end (not now) so the monthly cron prorates the
        // first invoice from the post-trial portion only.
        employer.paymentMethodAddedAt = employer.trialEndsAt ?? new Date();
      }
      await this.employerRepo.save(employer);
      this.logger.log(
        `Employer ${employer.id} TRIAL → ACTIVE (payment method already on file)`,
      );
      return;
    }
    employer.billingStatus = 'AWAITING_PAYMENT_METHOD';
    await this.employerRepo.save(employer);
    this.logger.log(
      `Employer ${employer.id} TRIAL → AWAITING_PAYMENT_METHOD (no invoice issued)`,
    );
    // TODO: send a transactional email here once the email service has a
    // template for "trial ended, please add a payment method." For now the
    // employer is alerted by the in-app banner only.
  }

  /**
   * Monthly billing: on day 1 of each month at 00:01, create an invoice
   * for every ACTIVE employer covering the previous full calendar month.
   * Employers in TRIAL or AWAITING_PAYMENT_METHOD are skipped — they get
   * billed only after they activate.
   *
   * Per spec §6, the invoice can be either full-month or partial: if the
   * employer's reactivation date (`paymentMethodAddedAt`) falls inside
   * the previous month, we prorate from that date instead of from day 1.
   */
  @Cron('1 0 1 * *', { name: 'billing-monthly-invoices' })
  async generateMonthlyInvoices() {
    if (!this.enabled) return;
    this.logger.log('🔄 Monthly billing job starting');

    const now = new Date();
    // Invoices cover the previous month.
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const employers = await this.employerRepo.find({
      where: { billingStatus: 'ACTIVE' },
    });
    this.logger.log(`Generating invoices for ${employers.length} active employers`);

    for (const employer of employers) {
      try {
        // Idempotency: skip if an invoice already exists for this period.
        const existing = await this.invoices.findByEmployer(employer.id);
        const alreadyExists = existing.find(
          (i) => i.periodStart === toIsoDate(periodStart),
        );
        if (alreadyExists) continue;

        // Default: full-month invoice covering periodStart → periodEnd.
        let invoiceStart = periodStart;
        let proratedDays: number | undefined;
        let daysInMonth: number | undefined;

        // If the employer activated mid-period (paymentMethodAddedAt sits
        // inside the previous month), prorate from that date so we only
        // bill for days the service was actually active.
        const reactivation = employer.paymentMethodAddedAt
          ? new Date(employer.paymentMethodAddedAt)
          : null;
        if (
          reactivation &&
          reactivation > periodStart &&
          reactivation <= periodEnd
        ) {
          invoiceStart = reactivation;
          daysInMonth = periodEnd.getDate();
          proratedDays = daysInMonth - reactivation.getDate() + 1;
        }

        await this.invoices.createForEmployer(employer, {
          periodStart: invoiceStart,
          periodEnd,
          proratedDays,
          daysInMonth,
        });
      } catch (err: any) {
        this.logger.error(
          `Failed monthly invoice for employer ${employer.id}: ${err.message}`,
          err.stack,
        );
      }
    }
    this.logger.log('✅ Monthly billing job done');
  }
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
