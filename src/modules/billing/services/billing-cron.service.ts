import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Employer } from '../../employers/entities/employer.entity';
import { InvoiceService } from './invoice.service';

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
  ) {}

  private get enabled(): boolean {
    return String(process.env.BILLING_CRON_ENABLED || '').toLowerCase() === 'true';
  }

  /**
   * Daily promotion: every employer whose trial has ended is flipped to
   * ACTIVE, and their first (prorated) invoice for the current month is
   * generated covering trial_ends_at → end-of-month.
   *
   * Runs at 04:00 every day.
   */
  @Cron('0 4 * * *', { name: 'billing-promote-trials' })
  async promoteTrialsToActive() {
    if (!this.enabled) return;
    this.logger.log('🔄 Trial promotion job starting');

    const now = new Date();
    const ended = await this.employerRepo.find({
      where: { billingStatus: 'TRIAL', trialEndsAt: LessThanOrEqual(now) as any },
    });
    this.logger.log(`Found ${ended.length} employers with ended trials`);

    for (const employer of ended) {
      try {
        await this.promoteOne(employer, now);
      } catch (err: any) {
        this.logger.error(
          `Failed to promote employer ${employer.id}: ${err.message}`,
          err.stack,
        );
      }
    }
    this.logger.log('✅ Trial promotion job done');
  }

  private async promoteOne(employer: Employer, now: Date) {
    // Effective billing start = the moment the trial ended.
    const effectiveStart = employer.trialEndsAt ? new Date(employer.trialEndsAt) : now;

    // Determine the period this first invoice covers (current calendar month).
    const periodStart = effectiveStart;
    const monthEnd = endOfMonth(effectiveStart);
    const daysInMonth = monthEnd.getDate();
    const proratedDays = monthEnd.getDate() - effectiveStart.getDate() + 1;

    // Idempotency: invoice may already exist (re-runs).
    const existing = await this.invoices.findByEmployer(employer.id);
    const alreadyHasFor = existing.find(
      (i) => i.periodStart === toIsoDate(periodStart),
    );
    if (!alreadyHasFor) {
      await this.invoices.createForEmployer(employer, {
        periodStart,
        periodEnd: monthEnd,
        proratedDays,
        daysInMonth,
      });
    }

    employer.billingStatus = 'ACTIVE';
    await this.employerRepo.save(employer);
    this.logger.log(`Employer ${employer.id} promoted TRIAL → ACTIVE`);
  }

  /**
   * Monthly billing: on day 1 of each month at 00:01, create an invoice
   * for every ACTIVE employer covering the previous full calendar month.
   * Cron spec breakdown: minute=1, hour=0, day-of-month=1 → midnight + 1 min
   * on the FIRST of every month. (Not the 3rd — common misread of "0 3 1".)
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

        await this.invoices.createForEmployer(employer, {
          periodStart,
          periodEnd,
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

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
