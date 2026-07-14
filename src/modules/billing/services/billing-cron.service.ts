import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { Employer } from '../../employers/entities/employer.entity';
import { BUSINESS_TZ, previousMonthRangeMadrid, madridDateKey } from '../../../common/helpers/business-time';
import { InvoiceService } from './invoice.service';
import { RatePlanService } from './rate-plan.service';
import { AutofacturaService } from './autofactura.service';
import { BankOperationsService } from './bank-operations.service';

/**
 * Scheduled jobs for the billing system.
 *
 * GATED behind env var BILLING_CRON_ENABLED. If unset (or "false"), every
 * scheduled tick is a no-op. This lets the code ship without auto-generating
 * real financial records until the operator flips the flag.
 */
@Injectable()
export class BillingCronService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BillingCronService.name);

  constructor(
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    private readonly invoices: InvoiceService,
    private readonly ratePlans: RatePlanService,
    private readonly autofacturas: AutofacturaService,
    private readonly bankOps: BankOperationsService,
  ) {}

  private get enabled(): boolean {
    return String(process.env.BILLING_CRON_ENABLED || '').toLowerCase() === 'true';
  }

  /**
   * Test/recovery hook: when BILLING_RUN_ON_BOOT=true, run the full monthly
   * close once on startup instead of waiting for day-1. Uses the exact cron
   * methods, so it targets the previous calendar month (e.g. boot in July →
   * bills June). Idempotent — safe to restart repeatedly. Remove the env var
   * after testing.
   */
  async onApplicationBootstrap() {
    if (String(process.env.BILLING_RUN_ON_BOOT || '').toLowerCase() !== 'true') return;
    if (!this.enabled) {
      this.logger.warn('BILLING_RUN_ON_BOOT set but BILLING_CRON_ENABLED is not true — skipping boot run.');
      return;
    }
    this.logger.log('🚀 BILLING_RUN_ON_BOOT: running previous-month close now (invoices → commissions → bank tasks)');
    try {
      await this.generateMonthlyInvoices();
      await this.generateMonthlyCommissions();
      await this.generateMonthlyBankTasks();
      this.logger.log('🚀 BILLING_RUN_ON_BOOT: done');
    } catch (err: any) {
      this.logger.error(`BILLING_RUN_ON_BOOT failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Manual admin recovery: run the previous-month close now (invoices →
   * commissions → bank tasks), regardless of the BILLING_CRON_ENABLED flag.
   * Idempotent — only creates what's missing, never deletes/overwrites an
   * already-issued record (keeps invoice numbering correlative).
   */
  async runMonthlyCloseNow() {
    this.logger.log('🖐️ Manual monthly close requested (admin)');
    await this.generateMonthlyInvoices(true);
    await this.generateMonthlyCommissions(true);
    await this.generateMonthlyBankTasks(true);
    this.logger.log('🖐️ Manual monthly close done');
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
  @Cron('0 3 * * *', { name: 'billing-promote-rate-plans', timeZone: BUSINESS_TZ })
  async promotePendingRatePlans() {
    if (!this.enabled) return;
    const promoted = await this.ratePlans.promoteDuePending();
    if (promoted > 0) {
      this.logger.log(`Promoted ${promoted} rate plan(s) from pending → live`);
    }
  }

  @Cron('0 4 * * *', { name: 'billing-promote-trials', timeZone: BUSINESS_TZ })
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
  @Cron('1 0 1 * *', { name: 'billing-monthly-invoices', timeZone: BUSINESS_TZ })
  async generateMonthlyInvoices(force = false) {
    if (!this.enabled && !force) return;
    this.logger.log('🔄 Monthly billing job starting');

    // Invoices cover the previous month (anchored to Europe/Madrid).
    const { startDate: periodStart, endDate: periodEnd, startIso: periodStartIso, endIso: periodEndIso } = previousMonthRangeMadrid();

    const employers = await this.employerRepo.find({
      where: { billingStatus: 'ACTIVE' },
    });
    this.logger.log(`Generating invoices for ${employers.length} active employers`);

    for (const employer of employers) {
      try {
        // Idempotency: skip if an invoice already exists for this period.
        const existing = await this.invoices.findByEmployer(employer.id);
        const alreadyExists = existing.find(
          (i) => i.periodStart === periodStartIso,
        );
        if (alreadyExists) continue;

        // Default: full-month invoice covering periodStart → periodEnd.
        let invoiceStart = periodStart;
        let proratedDays: number | undefined;
        let daysInMonth: number | undefined;

        // If the employer activated mid-period (paymentMethodAddedAt sits
        // inside the previous month), prorate from that date so we only bill
        // for days the service was actually active. The reactivation day is
        // taken as its Madrid civil day so a card added just after Madrid
        // midnight isn't attributed to the previous (UTC) day.
        const reactivation = employer.paymentMethodAddedAt
          ? madridDateKey(new Date(employer.paymentMethodAddedAt))
          : null;
        if (
          reactivation &&
          reactivation > periodStartIso &&
          reactivation <= periodEndIso
        ) {
          const reactDay = Number(reactivation.slice(8, 10));
          invoiceStart = new Date(periodStart.getFullYear(), periodStart.getMonth(), reactDay);
          daysInMonth = periodEnd.getDate();
          proratedDays = daysInMonth - reactDay + 1;
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

  /**
   * Monthly commission self-invoices (autofacturas): runs at 00:10 on day 1,
   * shortly after employer invoices are generated (00:01), so the commission
   * base — the employers' invoices for the previous month — already exists.
   * One autofactura per partner that has commissionable invoices in the period.
   */
  @Cron('10 0 1 * *', { name: 'billing-monthly-commissions', timeZone: BUSINESS_TZ })
  async generateMonthlyCommissions(force = false) {
    if (!this.enabled && !force) return;
    this.logger.log('🔄 Monthly commissions job starting');
    const { startIso: periodStart, endIso: periodEnd } = previousMonthRangeMadrid();
    try {
      const created = await this.autofacturas.generateMonthlyForAllPartners(periodStart, periodEnd);
      this.logger.log(`✅ Monthly commissions job done — created ${created} autofactura(s)`);
    } catch (err: any) {
      this.logger.error(`Monthly commissions job failed: ${err.message}`, err.stack);
    }
  }

  /**
   * Month-end automatic close for "Bancos": creates the bank tasks (cobros/pagos)
   * the Admin and each Employer must order with their bank for the previous month.
   * Runs at 00:20 on day 1, after invoices (00:01) and commissions (00:10).
   */
  @Cron('20 0 1 * *', { name: 'billing-monthly-bank-tasks', timeZone: BUSINESS_TZ })
  async generateMonthlyBankTasks(force = false) {
    if (!this.enabled && !force) return;
    this.logger.log('🔄 Monthly bank-tasks job starting');
    const { startIso: periodStart, endIso: periodEnd } = previousMonthRangeMadrid();
    try {
      // Admin: collections (Facturas) + partner payments (Comisiones).
      await this.bankOps.closeMonth({ kind: 'all' } as any, 'FACTURAS', periodStart, periodEnd, 'AUTO');
      await this.bankOps.closeMonth({ kind: 'all' } as any, 'COMISIONES', periodStart, periodEnd, 'AUTO');
      // Each employer: client collections (Facturas) + worker payments (Salarios).
      const employers = await this.employerRepo.find();
      for (const e of employers) {
        const scope = { kind: 'employer', employerId: e.id } as any;
        await this.bankOps.closeMonth(scope, 'FACTURAS', periodStart, periodEnd, 'AUTO');
        await this.bankOps.closeMonth(scope, 'SALARIOS', periodStart, periodEnd, 'AUTO');
      }
      this.logger.log('✅ Monthly bank-tasks job done');
    } catch (err: any) {
      this.logger.error(`Monthly bank-tasks job failed: ${err.message}`, err.stack);
    }
  }
}
