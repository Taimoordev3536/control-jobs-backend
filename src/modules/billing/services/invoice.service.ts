import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Invoice, InvoiceStatus, InvoiceType } from '../entities/invoice.entity';
import { InvoiceWorkCenter } from '../entities/invoice-workcenter.entity';
import { InvoiceWorker } from '../entities/invoice-worker.entity';
import { InvoiceLine } from '../entities/invoice-line.entity';
import { CreateManualInvoiceDto } from '../dto/create-manual-invoice.dto';
import { RatePlan } from '../entities/rate-plan.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { EmployerWorker } from '../../employers/entities/employer-worker.entity';
import { EmployerWorkCenter } from '../../employers/entities/employer-work-center.entity';
import { WorkerUser } from '../../workers/entities/worker-user.entity';
import { AdminConfig } from '../../admin/entities/admin-config.entity';
import { AdminUser } from '../../users/entities/admin-user.entity';
import { resolveCompanyIdentity } from '../helpers/company-identity';
import { PaymentMethod } from '../../../shared/entities/payment-method.entity';
import { PricingService } from './pricing.service';
import { RatePlanService } from './rate-plan.service';
import { madridCivilToday } from '../../../common/helpers/business-time';

interface CreateInvoiceOptions {
  /** Period start date — first day this invoice covers. */
  periodStart: Date;
  /** Period end date (inclusive) — last day covered. */
  periodEnd: Date;
  /** Optional override for issue date (defaults to today). */
  issueDate?: Date;
  /** Days until payment is due, default 30. */
  dueDays?: number;
  /** If the period spans only part of the calendar month, set proratedDays/daysInMonth. */
  proratedDays?: number;
  daysInMonth?: number;
}

@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(InvoiceLine)
    private readonly invoiceLineRepo: Repository<InvoiceLine>,
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    @InjectRepository(EmployerWorker)
    private readonly employerWorkerRepo: Repository<EmployerWorker>,
    @InjectRepository(EmployerWorkCenter)
    private readonly employerWorkCenterRepo: Repository<EmployerWorkCenter>,
    @InjectRepository(WorkerUser)
    private readonly workerUserRepo: Repository<WorkerUser>,
    @InjectRepository(AdminConfig)
    private readonly adminConfigRepo: Repository<AdminConfig>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,
    @InjectRepository(RatePlan)
    private readonly ratePlanRepo: Repository<RatePlan>,
    @InjectRepository(PaymentMethod)
    private readonly paymentMethodRepo: Repository<PaymentMethod>,
    private readonly pricing: PricingService,
    private readonly ratePlanService: RatePlanService,
  ) {}

  /**
   * Create an invoice for an employer for a given period. Idempotent: if one
   * already exists for (employer_id, period_start) the unique constraint will
   * raise — caller should treat that as "already done."
   */
  async createForEmployer(
    employer: Employer,
    options: CreateInvoiceOptions,
  ): Promise<Invoice> {
    const issueDate = options.issueDate ?? madridCivilToday();
    const dueDays = options.dueDays ?? 30;
    const dueDate = addDays(issueDate, dueDays);

    // Counts of active relations
    const [workerCount, workCenterCount] = await Promise.all([
      this.employerWorkerRepo.count({
        where: { employer: { id: employer.id }, isActive: true },
      }),
      this.employerWorkCenterRepo.count({
        where: { employer: { id: employer.id }, isActive: true },
      }),
    ]);

    const adminConfig = await this.adminConfigRepo.find({ take: 1 });
    const vatPct = adminConfig.length ? Number(adminConfig[0].vatRate) || 0 : 0;

    const ratePlan = employer.ratePlanId
      ? await this.ratePlanRepo.findOne({ where: { id: employer.ratePlanId } })
      : null;
    const rates = ratePlan
      ? this.ratePlanService.getEffectiveRates(ratePlan, options.issueDate ?? new Date())
      : { monthlyFixed: 0, perWorkCenter: 0, perWorker: 0 };

    const isProrated =
      typeof options.proratedDays === 'number' &&
      typeof options.daysInMonth === 'number' &&
      options.proratedDays !== options.daysInMonth;

    const breakdown = this.pricing.calculate({
      monthlyFixed: rates.monthlyFixed,
      perWorkCenter: rates.perWorkCenter,
      perWorker: rates.perWorker,
      workCenters: workCenterCount,
      workers: workerCount,
      discountPct: Number(employer.discount) || 0,
      vatPct,
      proratedDays: isProrated ? options.proratedDays : undefined,
      daysInMonth: isProrated ? options.daysInMonth : undefined,
    });

    // "Page 2" snapshot prep — pull the active work-center + worker rows
    // that the count above was computed from, so we can store their NAMES
    // on the invoice. Loaded outside the transaction (read-only) and
    // persisted inside it so a partial failure doesn't leave the invoice
    // missing its detail rows.
    const wcLinks = await this.employerWorkCenterRepo.find({
      where: { employer: { id: employer.id }, isActive: true },
      relations: ['workCenter'],
    });
    const wkLinks = await this.employerWorkerRepo.find({
      where: { employer: { id: employer.id }, isActive: true },
      relations: ['worker'],
    });
    const workerIds = wkLinks.map((l) => l.worker?.id).filter(Boolean) as number[];
    const workerUserLinks = workerIds.length
      ? await this.workerUserRepo.find({
          where: workerIds.map((id) => ({ workerId: id })),
          relations: ['user'],
        })
      : [];
    const workerIdToName = new Map<number, string>();
    for (const link of workerUserLinks) {
      const u = link.user as any;
      if (!u) continue;
      const composed =
        (u.name && String(u.name).trim()) ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
        u.email;
      if (link.workerId && composed) workerIdToName.set(link.workerId, composed);
    }

    return await this.invoiceRepo.manager.transaction(async (manager) => {
      const invoiceNumber = await this.generateInvoiceNumber(
        manager,
        adminConfig.length ? adminConfig[0].invoiceSeries : 'CJOBS',
        issueDate,
      );

      const invoice = manager.create(Invoice, {
        invoiceNumber,
        employerId: employer.id,
        periodStart: toIsoDate(options.periodStart),
        periodEnd: toIsoDate(options.periodEnd),
        issueDate: toIsoDate(issueDate),
        dueDate: toIsoDate(dueDate),
        isProrated,
        proratedDays: isProrated ? (options.proratedDays as number) : null,
        daysInMonth: isProrated ? (options.daysInMonth as number) : null,
        monthlyFixedRate: rates.monthlyFixed,
        perWorkCenterRate: rates.perWorkCenter,
        perWorkerRate: rates.perWorker,
        fixedAmount: breakdown.fixedAmount,
        workcenterCount: workCenterCount,
        workcenterAmount: breakdown.workcenterAmount,
        workerCount,
        workerAmount: breakdown.workerAmount,
        subtotal: breakdown.subtotal,
        discountPct: breakdown.discountPct,
        discountAmount: breakdown.discountAmount,
        vatPct: breakdown.vatPct,
        vatAmount: breakdown.vatAmount,
        total: breakdown.total,
        status: 'PENDING' as InvoiceStatus,
      });

      const saved = await manager.save(Invoice, invoice);

      // Persist the snapshots in the same transaction. If anything fails
      // here, the invoice insert rolls back too — no half-saved invoices.
      const wcSnapshots = wcLinks
        .filter((l) => !!l.workCenter)
        .map((l) =>
          manager.create(InvoiceWorkCenter, {
            invoiceId: saved.id,
            workCenterId: l.workCenter.id,
            name: l.workCenter.name || `Work center #${l.workCenter.id}`,
          }),
        );
      if (wcSnapshots.length) await manager.save(InvoiceWorkCenter, wcSnapshots);

      const wkSnapshots = wkLinks
        .filter((l) => !!l.worker)
        .map((l) => {
          const id = l.worker.id;
          const name =
            workerIdToName.get(id) ||
            (l.worker as any).code ||
            `Worker #${id}`;
          return manager.create(InvoiceWorker, {
            invoiceId: saved.id,
            workerId: id,
            name,
          });
        });
      if (wkSnapshots.length) await manager.save(InvoiceWorker, wkSnapshots);

      this.logger.log(
        `Invoice ${saved.invoiceNumber} created for employer ${employer.id} ` +
          `(${breakdown.total} EUR, ${wcSnapshots.length} wc + ${wkSnapshots.length} workers snapshot)`,
      );
      return saved;
    });
  }

  /**
   * Create a manually-entered invoice or credit note (factura rectificativa)
   * from free-form lines. Totals (incl. negatives) are derived from the lines.
   */
  /**
   * Issue a credit note against an existing invoice.
   *
   * Built from the original rather than from a blank form: Spanish law
   * (RD 1619/2012 art. 15) requires a rectificative to name the invoice it
   * corrects and the reason, so deriving both removes any chance of the link
   * being wrong or missing. Its own R- series keeps the two sequences apart.
   */
  async rectify(
    publicId: string,
    opts: { reason: string; lineIds?: number[] },
  ): Promise<Invoice> {
    const original = await this.invoiceRepo.findOne({
      where: { publicId },
      relations: ['lines'],
    });
    if (!original) throw new NotFoundException('Invoice not found');
    if (original.invoiceType === 'RECTIFICATIVA') {
      throw new BadRequestException('A credit note cannot itself be rectified');
    }
    if (!opts.reason?.trim()) {
      throw new BadRequestException('A reason is required for a credit note');
    }

    const existing = await this.invoiceRepo.findOne({
      where: { rectifiesInvoiceId: original.id },
    });
    if (existing) {
      throw new BadRequestException(
        `This invoice was already rectified by ${existing.invoiceNumber}`,
      );
    }

    // Mirror the original's lines, negated. An auto invoice has no line rows,
    // so its three tariff concepts are reconstructed.
    const source = original.lines?.length
      ? original.lines
          .filter((l) => !opts.lineIds?.length || opts.lineIds.includes(l.id))
          .map((l) => ({ description: l.description, quantity: Number(l.quantity), unitPrice: -Number(l.unitPrice) }))
      : // Quantity 1 against the amount actually billed, not count x rate: on a
        // prorated month the stored rates are the full-month ones while the
        // amounts carry the proration, so count x rate credited back more than
        // was ever charged.
        [
          { description: 'Cuota fija', quantity: 1, unitPrice: -Number(original.fixedAmount || 0) },
          {
            description: `Centros de trabajo (${Number(original.workcenterCount || 0)})`,
            quantity: 1,
            unitPrice: -Number(original.workcenterAmount || 0),
          },
          {
            description: `Trabajadores (${Number(original.workerCount || 0)})`,
            quantity: 1,
            unitPrice: -Number(original.workerAmount || 0),
          },
        ].filter((l) => l.unitPrice !== 0);

    if (!source.length) {
      throw new BadRequestException('There is nothing to rectify on this invoice');
    }

    return this.createManual({
      employerId: original.employerId,
      invoiceType: 'RECTIFICATIVA',
      rectifiesInvoiceId: original.id,
      periodStart: original.periodStart,
      periodEnd: original.periodEnd,
      discountPct: Number(original.discountPct || 0),
      vatPct: Number(original.vatPct || 0),
      remarks: `Rectifica la factura ${original.invoiceNumber}. Motivo: ${opts.reason.trim()}`,
      lines: source,
    } as CreateManualInvoiceDto);
  }

  async createManual(dto: CreateManualInvoiceDto): Promise<Invoice> {
    const employer = await this.employerRepo.findOne({
      where: { id: dto.employerId },
    });
    if (!employer) throw new NotFoundException('Employer not found');

    const invoiceType: InvoiceType = dto.invoiceType ?? 'NORMAL';
    if (invoiceType === 'RECTIFICATIVA' && !dto.rectifiesInvoiceId) {
      throw new BadRequestException(
        'rectifiesInvoiceId is required for a credit note',
      );
    }
    if (!dto.lines?.length) {
      throw new BadRequestException('At least one line is required');
    }
    if (dto.chargeDate) {
      const today = toIsoDate(new Date());
      if (dto.chargeDate < today) {
        throw new BadRequestException(
          'The charge date cannot be earlier than today',
        );
      }
    }

    const issueDate = dto.issueDate ? new Date(dto.issueDate) : new Date();
    const dueDate = addDays(issueDate, 30);
    const periodStart = dto.periodStart ? new Date(dto.periodStart) : issueDate;
    const periodEnd = dto.periodEnd ? new Date(dto.periodEnd) : issueDate;
    if (periodEnd < periodStart) {
      throw new BadRequestException(
        'The end date must be on or after the start date',
      );
    }

    const adminConfig = await this.adminConfigRepo.find({ take: 1 });
    const baseSeries = adminConfig.length ? adminConfig[0].invoiceSeries : 'CJOBS';
    // Credit notes run in their own series, so neither sequence gets a hole.
    const series = invoiceType === 'RECTIFICATIVA' ? `${baseSeries}-R` : baseSeries;
    const vatPct =
      dto.vatPct ??
      (adminConfig.length ? Number(adminConfig[0].vatRate) || 0 : 0);
    const discountPct = dto.discountPct ?? 0;

    const lines = dto.lines.map((l, i) => ({
      description: l.description,
      quantity: round2(l.quantity),
      unitPrice: round2(l.unitPrice),
      lineTotal: round2(l.quantity * l.unitPrice),
      sortOrder: i,
    }));

    const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
    const discountAmount = round2((subtotal * discountPct) / 100);
    const taxBase = round2(subtotal - discountAmount);
    const vatAmount = round2((taxBase * vatPct) / 100);
    const total = round2(taxBase + vatAmount);

    return await this.invoiceRepo.manager.transaction(async (manager) => {
      const invoiceNumber = await this.generateInvoiceNumber(
        manager,
        series,
        issueDate,
      );

      const invoice = manager.create(Invoice, {
        invoiceNumber,
        employerId: employer.id,
        periodStart: toIsoDate(periodStart),
        periodEnd: toIsoDate(periodEnd),
        issueDate: toIsoDate(issueDate),
        dueDate: toIsoDate(dueDate),
        chargeDate: dto.chargeDate || null,
        remarks: dto.remarks || null,
        isProrated: false,
        proratedDays: null,
        daysInMonth: null,
        monthlyFixedRate: 0,
        perWorkCenterRate: 0,
        perWorkerRate: 0,
        fixedAmount: 0,
        workcenterCount: 0,
        workcenterAmount: 0,
        workerCount: 0,
        workerAmount: 0,
        subtotal,
        discountPct,
        discountAmount,
        vatPct,
        vatAmount,
        total,
        status: 'PENDING' as InvoiceStatus,
        invoiceType,
        isManual: true,
        rectifiesInvoiceId: dto.rectifiesInvoiceId ?? null,
        paymentMethodId: dto.paymentMethodId ?? employer.paymentMethodId ?? null,
      });

      const saved = await manager.save(Invoice, invoice);

      const lineRows = lines.map((l) =>
        manager.create(InvoiceLine, { ...l, invoiceId: saved.id }),
      );
      await manager.save(InvoiceLine, lineRows);

      this.logger.log(
        `Manual ${invoiceType} ${saved.invoiceNumber} created for employer ${employer.id} (${total} EUR, ${lineRows.length} lines)`,
      );
      return saved;
    });
  }

  /**
   * Build the next invoice number for a (series, year) bucket.
   * Format: SERIES-YYYY-NNNNNN. Sequential per calendar year, starting at 1
   * each January — Spanish accounting law requires invoices to be numbered
   * without gaps within a series, but a per-year reset (or carry-over from
   * the previous year) is permitted. We chose per-year reset to match the
   * client's requested format ("CJOBS-YYYY-NNNNNN").
   *
   * NOTE: invoices issued under the previous "SERIES-YYYY-MM-NNNNNN" format
   * (created before this change) are still in the table. The LIKE filter
   * scopes only to the new format so the per-year counter starts cleanly
   * at 1 instead of being skewed by old per-month numbers.
   */
  private async generateInvoiceNumber(
    manager: EntityManager,
    series: string,
    issueDate: Date,
  ): Promise<string> {
    const yyyy = issueDate.getFullYear();
    const prefix = `${series}-${yyyy}-`;

    // The new format has exactly one '-' between the year and the counter
    // (no month segment). Match `SERIES-YYYY-NNNNNN` strictly and exclude
    // the legacy `SERIES-YYYY-MM-NNNNNN` rows that share the same prefix.
    const result = await manager.query(
      `SELECT invoice_number FROM cjobs_invoices
        WHERE invoice_number LIKE $1
          AND invoice_number !~ $2
        ORDER BY invoice_number DESC
        LIMIT 1
        FOR UPDATE`,
      [`${prefix}%`, `^${series}-${yyyy}-\\d{2}-`],
    );

    let next = 1;
    if (result.length > 0) {
      const last = String(result[0].invoice_number);
      const tail = parseInt(last.slice(prefix.length), 10);
      if (Number.isFinite(tail)) next = tail + 1;
    }
    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  /**
   * Next number in the active series, read-only (no FOR UPDATE lock), used to
   * preview the upcoming invoice number in the form. The number is only
   * reserved when the invoice is actually created.
   */
  async previewNextInvoiceNumber(issueDate: Date = madridCivilToday()): Promise<string> {
    const config = (await this.adminConfigRepo.find({ take: 1 }))[0];
    const series = config?.invoiceSeries || 'CJOBS';
    const yyyy = issueDate.getFullYear();
    const prefix = `${series}-${yyyy}-`;
    const result = await this.invoiceRepo.query(
      `SELECT invoice_number FROM cjobs_invoices
        WHERE invoice_number LIKE $1
          AND invoice_number !~ $2
        ORDER BY invoice_number DESC
        LIMIT 1`,
      [`${prefix}%`, `^${series}-${yyyy}-\\d{2}-`],
    );
    let next = 1;
    if (result.length > 0) {
      const last = String(result[0].invoice_number);
      const tail = parseInt(last.slice(prefix.length), 10);
      if (Number.isFinite(tail)) next = tail + 1;
    }
    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  /** Company + client + payment + tariff context the Factura form renders. */
  async getInvoiceFormContext(employerId?: number) {
    const config = (await this.adminConfigRepo.find({ take: 1 }))[0];
    const employer = employerId
      ? await this.employerRepo.findOne({
          where: { id: employerId },
          relations: ['paymentMethod', 'partner'],
        })
      : null;
    const ratePlan = employer?.ratePlanId
      ? await this.ratePlanRepo.findOne({ where: { id: employer.ratePlanId } })
      : null;
    const paymentMethods = await this.paymentMethodRepo.find({
      where: { isActive: true, isSelfService: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
    const partnerCommission = Number((employer?.partner as any)?.commission) || 0;
    const identity = await resolveCompanyIdentity(this.adminUserRepo);
    const company = identity
      ? { ...identity, paymentDetails: config?.paymentDetails ?? null }
      : config
        ? { name: config.companyName, address: config.address, paymentDetails: config.paymentDetails }
        : null;
    const nextInvoiceNumber = await this.previewNextInvoiceNumber();
    return {
      company,
      nextInvoiceNumber,
      client: employer
        ? {
            id: employer.id,
            name: employer.name,
            taxId: employer.taxId,
            address: employer.address,
            floorDoor: employer.floorDoor,
            postalCode: employer.postalCode,
            city: employer.city,
            province: employer.province,
            country: employer.country,
          }
        : null,
      payment: {
        methodId: employer?.paymentMethodId ?? null,
        methodCode: (employer?.paymentMethod as any)?.name ?? null,
        methodName: (employer?.paymentMethod as any)?.name ?? null,
        ibanMasked: maskIban(employer?.accountIban),
        cardMasked: employer?.cardLast4 ? `**** **** **** ${employer.cardLast4}` : null,
        paypalEmail: employer?.paypalEmail ?? null,
      },
      paymentMethods: paymentMethods.map((m) => ({ id: m.id, name: m.name })),
      tariff: ratePlan
        ? { code: ratePlan.code, label: ratePlan.label, tariffType: ratePlan.tariffType }
        : null,
      defaultDiscount: partnerCommission,
      partnerCommission,
    };
  }

  /** The employer's current active work centers + workers (id + name). */
  async getEmployerBillingEntities(
    employerId: number,
  ): Promise<{ workCenters: { id: number; name: string }[]; workers: { id: number; name: string }[] }> {
    const wcLinks = await this.employerWorkCenterRepo.find({
      where: { employer: { id: employerId }, isActive: true },
      relations: ['workCenter'],
    });
    const workCenters = wcLinks
      .filter((l) => l.workCenter)
      .map((l) => ({ id: l.workCenter.id, name: l.workCenter.name || `Work center #${l.workCenter.id}` }));

    const wkLinks = await this.employerWorkerRepo.find({
      where: { employer: { id: employerId }, isActive: true },
      relations: ['worker'],
    });
    const workerIds = wkLinks
      .map((l) => l.worker?.id)
      .filter((id): id is number => !!id);
    const workerUserLinks = workerIds.length
      ? await this.workerUserRepo.find({
          where: workerIds.map((id) => ({ workerId: id })),
          relations: ['user'],
        })
      : [];
    const idToName = new Map<number, string>();
    for (const link of workerUserLinks) {
      const u = link.user as any;
      if (!u) continue;
      const composed =
        (u.name && String(u.name).trim()) ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
        u.email;
      if (link.workerId && composed) idToName.set(link.workerId, composed);
    }
    const workers = wkLinks
      .filter((l) => l.worker)
      .map((l) => ({
        id: l.worker.id,
        name:
          idToName.get(l.worker.id) ||
          (l.worker as any).code ||
          `Worker #${l.worker.id}`,
      }));

    return { workCenters, workers };
  }

  /**
   * Compute (without persisting) the auto invoice an employer would get for a
   * period, shaped like a view invoice so the form can render it identically.
   */
  async previewForEmployer(
    employerId: number,
    periodStart: Date,
    periodEnd: Date,
  ) {
    const employer = await this.employerRepo.findOne({
      where: { id: employerId },
    });
    if (!employer) throw new NotFoundException('Employer not found');

    const [workerCount, workCenterCount] = await Promise.all([
      this.employerWorkerRepo.count({
        where: { employer: { id: employerId }, isActive: true },
      }),
      this.employerWorkCenterRepo.count({
        where: { employer: { id: employerId }, isActive: true },
      }),
    ]);

    const adminConfig = await this.adminConfigRepo.find({ take: 1 });
    const vatPct = adminConfig.length ? Number(adminConfig[0].vatRate) || 0 : 0;

    const ratePlan = employer.ratePlanId
      ? await this.ratePlanRepo.findOne({ where: { id: employer.ratePlanId } })
      : null;
    const rates = ratePlan
      ? this.ratePlanService.getEffectiveRates(ratePlan, periodStart)
      : { monthlyFixed: 0, perWorkCenter: 0, perWorker: 0 };

    const breakdown = this.pricing.calculate({
      monthlyFixed: rates.monthlyFixed,
      perWorkCenter: rates.perWorkCenter,
      perWorker: rates.perWorker,
      workCenters: workCenterCount,
      workers: workerCount,
      discountPct: Number(employer.discount) || 0,
      vatPct,
    });

    const context = await this.getInvoiceFormContext(employerId);
    const entities = await this.getEmployerBillingEntities(employerId);

    return {
      invoiceNumber: null,
      employerId,
      issueDate: toIsoDate(new Date()),
      periodStart: toIsoDate(periodStart),
      periodEnd: toIsoDate(periodEnd),
      chargeDate: null,
      monthlyFixedRate: rates.monthlyFixed,
      perWorkCenterRate: rates.perWorkCenter,
      perWorkerRate: rates.perWorker,
      fixedAmount: breakdown.fixedAmount,
      workcenterCount: workCenterCount,
      workcenterAmount: breakdown.workcenterAmount,
      workerCount,
      workerAmount: breakdown.workerAmount,
      subtotal: breakdown.subtotal,
      discountPct: breakdown.discountPct,
      discountAmount: breakdown.discountAmount,
      vatPct: breakdown.vatPct,
      vatAmount: breakdown.vatAmount,
      total: breakdown.total,
      isManual: false,
      remarks: null,
      accessLevel: 'full',
      workCenters: entities.workCenters,
      workers: entities.workers,
      ...context,
    };
  }

  /** Months (YYYY-MM) that already have an auto invoice for this employer. */
  async getInvoicedMonths(employerId: number): Promise<string[]> {
    const rows = await this.invoiceRepo.query(
      `SELECT DISTINCT to_char(period_start,'YYYY-MM') AS m
         FROM cjobs_invoices
        WHERE employer_id = $1 AND is_manual = false
        ORDER BY m`,
      [employerId],
    );
    return rows.map((r: any) => r.m);
  }

  /** Manually generate (persist) the auto invoice for an employer + period. */
  async generateForEmployer(
    employerId: number,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<Invoice> {
    const employer = await this.employerRepo.findOne({
      where: { id: employerId },
    });
    if (!employer) throw new NotFoundException('Employer not found');
    return this.createForEmployer(employer, { periodStart, periodEnd });
  }

  /**
   * Generate an invoice from an admin-edited selection: a chosen subset of the
   * employer's work centers/workers, plus overrides for the fixed fee, discount
   * and due date. Snapshots only the selected entities.
   */
  async createCustomForEmployer(
    employerId: number,
    opts: {
      periodStart: Date;
      periodEnd: Date;
      chargeDate?: string;
      workCenterIds: number[];
      workerIds: number[];
      fixedFee: number;
      discountPct: number;
    },
  ): Promise<Invoice> {
    const employer = await this.employerRepo.findOne({ where: { id: employerId } });
    if (!employer) throw new NotFoundException('Employer not found');

    const issueDate = new Date();
    const dueDate = addDays(issueDate, 30);

    const adminConfig = await this.adminConfigRepo.find({ take: 1 });
    const vatPct = adminConfig.length ? Number(adminConfig[0].vatRate) || 0 : 0;

    const ratePlan = employer.ratePlanId
      ? await this.ratePlanRepo.findOne({ where: { id: employer.ratePlanId } })
      : null;
    const rates = ratePlan
      ? this.ratePlanService.getEffectiveRates(ratePlan, issueDate)
      : { monthlyFixed: 0, perWorkCenter: 0, perWorker: 0 };

    const wcIdSet = new Set(opts.workCenterIds);
    const workerIdSet = new Set(opts.workerIds);
    const wcLinks = (
      await this.employerWorkCenterRepo.find({
        where: { employer: { id: employerId }, isActive: true },
        relations: ['workCenter'],
      })
    ).filter((l) => l.workCenter && wcIdSet.has(l.workCenter.id));
    const wkLinks = (
      await this.employerWorkerRepo.find({
        where: { employer: { id: employerId }, isActive: true },
        relations: ['worker'],
      })
    ).filter((l) => l.worker && workerIdSet.has(l.worker.id));

    const workCenterCount = wcLinks.length;
    const workerCount = wkLinks.length;

    const breakdown = this.pricing.calculate({
      monthlyFixed: opts.fixedFee,
      perWorkCenter: rates.perWorkCenter,
      perWorker: rates.perWorker,
      workCenters: workCenterCount,
      workers: workerCount,
      discountPct: opts.discountPct,
      vatPct,
    });

    const workerIds = wkLinks.map((l) => l.worker.id);
    const workerUserLinks = workerIds.length
      ? await this.workerUserRepo.find({
          where: workerIds.map((id) => ({ workerId: id })),
          relations: ['user'],
        })
      : [];
    const workerIdToName = new Map<number, string>();
    for (const link of workerUserLinks) {
      const u = link.user as any;
      if (!u) continue;
      const composed =
        (u.name && String(u.name).trim()) ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
        u.email;
      if (link.workerId && composed) workerIdToName.set(link.workerId, composed);
    }

    return await this.invoiceRepo.manager.transaction(async (manager) => {
      const invoiceNumber = await this.generateInvoiceNumber(
        manager,
        adminConfig.length ? adminConfig[0].invoiceSeries : 'CJOBS',
        issueDate,
      );

      const invoice = manager.create(Invoice, {
        invoiceNumber,
        employerId: employer.id,
        periodStart: toIsoDate(opts.periodStart),
        periodEnd: toIsoDate(opts.periodEnd),
        issueDate: toIsoDate(issueDate),
        dueDate: toIsoDate(dueDate),
        chargeDate: opts.chargeDate || null,
        isProrated: false,
        proratedDays: null,
        daysInMonth: null,
        monthlyFixedRate: opts.fixedFee,
        perWorkCenterRate: rates.perWorkCenter,
        perWorkerRate: rates.perWorker,
        fixedAmount: breakdown.fixedAmount,
        workcenterCount: workCenterCount,
        workcenterAmount: breakdown.workcenterAmount,
        workerCount,
        workerAmount: breakdown.workerAmount,
        subtotal: breakdown.subtotal,
        discountPct: breakdown.discountPct,
        discountAmount: breakdown.discountAmount,
        vatPct: breakdown.vatPct,
        vatAmount: breakdown.vatAmount,
        total: breakdown.total,
        status: 'PENDING' as InvoiceStatus,
        paymentMethodId: employer.paymentMethodId ?? null,
      });

      const saved = await manager.save(Invoice, invoice);

      const wcSnapshots = wcLinks.map((l) =>
        manager.create(InvoiceWorkCenter, {
          invoiceId: saved.id,
          workCenterId: l.workCenter.id,
          name: l.workCenter.name || `Work center #${l.workCenter.id}`,
        }),
      );
      if (wcSnapshots.length) await manager.save(InvoiceWorkCenter, wcSnapshots);

      const wkSnapshots = wkLinks.map((l) =>
        manager.create(InvoiceWorker, {
          invoiceId: saved.id,
          workerId: l.worker.id,
          name:
            workerIdToName.get(l.worker.id) ||
            (l.worker as any).code ||
            `Worker #${l.worker.id}`,
        }),
      );
      if (wkSnapshots.length) await manager.save(InvoiceWorker, wkSnapshots);

      this.logger.log(
        `Custom invoice ${saved.invoiceNumber} created for employer ${employer.id} ` +
          `(${breakdown.total} EUR, ${wcSnapshots.length} wc + ${wkSnapshots.length} workers)`,
      );
      return saved;
    });
  }

  /**
   * Look up an invoice by publicId or fail. Loads the page-2 snapshots
   * (work centers + workers) so the detail endpoint and PDF renderer
   * can decide what to show based on the caller's access level.
   */
  async findByPublicId(publicId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { publicId },
      relations: ['workCenters', 'workers', 'lines', 'paymentMethod'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  /** List all invoices for one employer, newest first. */
  findByEmployer(employerId: number): Promise<Invoice[]> {
    return this.invoiceRepo.find({
      where: { employerId },
      order: { issueDate: 'DESC', id: 'DESC' },
    });
  }

  /** Paginated list with simple filtering + role scoping. */
  async list(options: {
    employerId?: number;
    partnerId?: number;
    status?: InvoiceStatus;
    page?: number;
    pageSize?: number;
    /** Scope hard-filters the query to a partner's employers or a single employer. */
    scope?:
      | { kind: 'all' }
      | { kind: 'partner'; partnerId: number }
      | { kind: 'employer'; employerId: number };
  }): Promise<{ data: Invoice[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 25));

    // Use entity-property references throughout (inv.issueDate, not inv.issue_date)
    // so TypeORM resolves metadata. Raw column refs break getManyAndCount + joins
    // in TypeORM 0.3.
    const qb = this.invoiceRepo
      .createQueryBuilder('inv')
      .orderBy('inv.issueDate', 'DESC')
      .addOrderBy('inv.invoiceNumber', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    // Role scope first — this is the auth filter.
    if (options.scope?.kind === 'employer') {
      qb.andWhere('inv.employerId = :scopedEmployerId', {
        scopedEmployerId: options.scope.employerId,
      });
    } else if (options.scope?.kind === 'partner') {
      qb.innerJoin(
        Employer,
        'emp',
        'emp.id = inv.employerId AND emp.partnerId = :scopedPartnerId',
        { scopedPartnerId: options.scope.partnerId },
      );
    }

    // User-supplied filters layer on top.
    if (options.employerId) {
      qb.andWhere('inv.employerId = :employerId', { employerId: options.employerId });
    }
    if (options.partnerId) {
      qb.innerJoin(
        Employer,
        'pf',
        'pf.id = inv.employerId AND pf.partnerId = :filterPartnerId',
        { filterPartnerId: options.partnerId },
      );
    }
    if (options.status) {
      qb.andWhere('inv.status = :status', { status: options.status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async setPaymentMethod(
    publicId: string,
    paymentMethodId: number,
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { publicId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    const method = await this.paymentMethodRepo.findOne({
      where: { id: paymentMethodId, isActive: true },
    });
    if (!method) throw new BadRequestException('Invalid payment method');
    invoice.paymentMethodId = paymentMethodId;
    return this.invoiceRepo.save(invoice);
  }

  async markPaid(publicId: string): Promise<Invoice> {
    const invoice = await this.findByPublicId(publicId);
    if (invoice.status === 'PAID') {
      throw new BadRequestException('This invoice is already marked as paid');
    }
    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('A cancelled invoice cannot be marked as paid');
    }
    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    return this.invoiceRepo.save(invoice);
  }

  async cancel(publicId: string): Promise<Invoice> {
    const invoice = await this.findByPublicId(publicId);
    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('This invoice is already cancelled');
    }
    // A paid invoice is corrected with a credit note, not cancelled — the
    // payment already happened and the books have to show it.
    if (invoice.status === 'PAID') {
      throw new BadRequestException(
        'A paid invoice cannot be cancelled. Issue a credit note instead.',
      );
    }
    invoice.status = 'CANCELLED';
    return this.invoiceRepo.save(invoice);
  }

  /**
   * Data for the edit screen: the invoice's current values + the employer's
   * active work centers/workers (pool) with the currently-billed ones flagged.
   */
  async getEditContext(publicId: string) {
    const invoice = await this.findByPublicId(publicId);
    const context = await this.getInvoiceFormContext(invoice.employerId);
    const pool = await this.getEmployerBillingEntities(invoice.employerId);

    const wcMap = new Map<number, string>(pool.workCenters.map((w) => [w.id, w.name]));
    invoice.workCenters.forEach((s: any) => {
      const id = Number(s.workCenterId);
      if (!wcMap.has(id)) wcMap.set(id, s.name);
    });
    const workerMap = new Map<number, string>(pool.workers.map((w) => [w.id, w.name]));
    invoice.workers.forEach((s: any) => {
      const id = Number(s.workerId);
      if (!workerMap.has(id)) workerMap.set(id, s.name);
    });

    return {
      publicId: invoice.publicId,
      employerId: invoice.employerId,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      periodStart: invoice.periodStart,
      periodEnd: invoice.periodEnd,
      dueDate: invoice.dueDate,
      chargeDate: invoice.chargeDate,
      monthlyFixedRate: invoice.monthlyFixedRate,
      perWorkCenterRate: invoice.perWorkCenterRate,
      perWorkerRate: invoice.perWorkerRate,
      discountPct: invoice.discountPct,
      vatPct: invoice.vatPct,
      isManual: invoice.isManual,
      accessLevel: 'full',
      workCenters: Array.from(wcMap, ([id, name]) => ({ id, name })),
      workers: Array.from(workerMap, ([id, name]) => ({ id, name })),
      selectedWorkCenterIds: invoice.workCenters.map((s: any) => Number(s.workCenterId)),
      selectedWorkerIds: invoice.workers.map((s: any) => Number(s.workerId)),
      ...context,
    };
  }

  /** Recompute + update an existing invoice from edited selections/overrides. */
  async updateInvoice(
    publicId: string,
    opts: {
      chargeDate?: string;
      workCenterIds: number[];
      workerIds: number[];
      fixedFee: number;
      discountPct: number;
    },
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({
      where: { publicId },
      relations: ['workCenters', 'workers'],
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    // An issued invoice that has been settled or voided is a closed document;
    // editing its amounts after the fact is what a credit note is for.
    if (invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
      throw new BadRequestException(
        `A ${invoice.status === 'PAID' ? 'paid' : 'cancelled'} invoice cannot be edited. Issue a credit note instead.`,
      );
    }
    if (invoice.invoiceType === 'RECTIFICATIVA') {
      throw new BadRequestException('A credit note cannot be edited');
    }
    const employer = await this.employerRepo.findOne({ where: { id: invoice.employerId } });

    const ratePlan = employer?.ratePlanId
      ? await this.ratePlanRepo.findOne({ where: { id: employer.ratePlanId } })
      : null;
    const rates = ratePlan
      ? this.ratePlanService.getEffectiveRates(ratePlan)
      : { monthlyFixed: 0, perWorkCenter: 0, perWorker: 0 };
    const vatPct = Number(invoice.vatPct) || 0;

    const wcCount = opts.workCenterIds.length;
    const workerCount = opts.workerIds.length;
    const breakdown = this.pricing.calculate({
      monthlyFixed: opts.fixedFee,
      perWorkCenter: rates.perWorkCenter,
      perWorker: rates.perWorker,
      workCenters: wcCount,
      workers: workerCount,
      discountPct: opts.discountPct,
      vatPct,
    });

    // Name maps: prefer current active names, fall back to existing snapshot names.
    const activeWc = await this.employerWorkCenterRepo.find({
      where: { employer: { id: invoice.employerId }, isActive: true },
      relations: ['workCenter'],
    });
    const wcNameMap = new Map<number, string>();
    activeWc.forEach((l) => {
      if (l.workCenter) wcNameMap.set(l.workCenter.id, l.workCenter.name || `Work center #${l.workCenter.id}`);
    });
    invoice.workCenters.forEach((s: any) => {
      if (!wcNameMap.has(s.workCenterId)) wcNameMap.set(s.workCenterId, s.name);
    });

    const activeWk = await this.employerWorkerRepo.find({
      where: { employer: { id: invoice.employerId }, isActive: true },
      relations: ['worker'],
    });
    const activeWorkerIds = activeWk.map((l) => l.worker?.id).filter((id): id is number => !!id);
    const workerUserLinks = activeWorkerIds.length
      ? await this.workerUserRepo.find({
          where: activeWorkerIds.map((id) => ({ workerId: id })),
          relations: ['user'],
        })
      : [];
    const composed = new Map<number, string>();
    for (const link of workerUserLinks) {
      const u = link.user as any;
      if (!u) continue;
      const name =
        (u.name && String(u.name).trim()) ||
        [u.firstName, u.lastName].filter(Boolean).join(' ').trim() ||
        u.email;
      if (link.workerId && name) composed.set(link.workerId, name);
    }
    const workerNameMap = new Map<number, string>();
    activeWk.forEach((l) => {
      if (l.worker) workerNameMap.set(l.worker.id, composed.get(l.worker.id) || (l.worker as any).code || `Worker #${l.worker.id}`);
    });
    invoice.workers.forEach((s: any) => {
      if (!workerNameMap.has(s.workerId)) workerNameMap.set(s.workerId, s.name);
    });

    return await this.invoiceRepo.manager.transaction(async (manager) => {
      invoice.monthlyFixedRate = opts.fixedFee;
      invoice.perWorkCenterRate = rates.perWorkCenter;
      invoice.perWorkerRate = rates.perWorker;
      invoice.fixedAmount = breakdown.fixedAmount;
      invoice.workcenterCount = wcCount;
      invoice.workcenterAmount = breakdown.workcenterAmount;
      invoice.workerCount = workerCount;
      invoice.workerAmount = breakdown.workerAmount;
      invoice.subtotal = breakdown.subtotal;
      invoice.discountPct = breakdown.discountPct;
      invoice.discountAmount = breakdown.discountAmount;
      invoice.vatAmount = breakdown.vatAmount;
      invoice.total = breakdown.total;
      if (opts.chargeDate !== undefined) invoice.chargeDate = opts.chargeDate || null;
      await manager.save(Invoice, invoice);

      await manager.delete(InvoiceWorkCenter, { invoiceId: invoice.id });
      await manager.delete(InvoiceWorker, { invoiceId: invoice.id });
      const wcSnaps = opts.workCenterIds.map((id) =>
        manager.create(InvoiceWorkCenter, {
          invoiceId: invoice.id,
          workCenterId: id,
          name: wcNameMap.get(id) || `Work center #${id}`,
        }),
      );
      if (wcSnaps.length) await manager.save(InvoiceWorkCenter, wcSnaps);
      const wkSnaps = opts.workerIds.map((id) =>
        manager.create(InvoiceWorker, {
          invoiceId: invoice.id,
          workerId: id,
          name: workerNameMap.get(id) || `Worker #${id}`,
        }),
      );
      if (wkSnaps.length) await manager.save(InvoiceWorker, wkSnaps);

      return invoice;
    });
  }

  /** Hard-delete an invoice and its line/snapshot rows. */
  async isLastInvoice(invoiceNumber: string | null): Promise<boolean> {
    if (!invoiceNumber || invoiceNumber.length <= 6) return false;
    const prefix = invoiceNumber.slice(0, invoiceNumber.length - 6);
    const rows = await this.invoiceRepo.query(
      `SELECT MAX(invoice_number) AS max FROM cjobs_invoices
        WHERE invoice_number LIKE $1 AND length(invoice_number) = $2`,
      [`${prefix}%`, invoiceNumber.length],
    );
    return rows[0]?.max === invoiceNumber;
  }

  /** Number of the credit note correcting this invoice, if one was issued. */
  async rectifiedBy(invoiceId: number): Promise<string | null> {
    const row = await this.invoiceRepo.findOne({ where: { rectifiesInvoiceId: invoiceId } });
    return row?.invoiceNumber ?? null;
  }

  async deleteInvoice(publicId: string): Promise<void> {
    const invoice = await this.invoiceRepo.findOne({ where: { publicId } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'PENDING') {
      throw new BadRequestException('Only pending invoices can be deleted');
    }
    const rectifiedBy = await this.invoiceRepo.findOne({
      where: { rectifiesInvoiceId: invoice.id },
    });
    if (rectifiedBy) {
      throw new BadRequestException(
        `This invoice cannot be deleted: it was rectified by ${rectifiedBy.invoiceNumber}`,
      );
    }
    if (!(await this.isLastInvoice(invoice.invoiceNumber))) {
      throw new BadRequestException(
        'Only the last invoice can be deleted, to keep the numbering sequential',
      );
    }
    await this.invoiceRepo.manager.transaction(async (manager) => {
      await manager.delete(InvoiceLine, { invoiceId: invoice.id });
      await manager.delete(InvoiceWorkCenter, { invoiceId: invoice.id });
      await manager.delete(InvoiceWorker, { invoiceId: invoice.id });
      await manager.delete(Invoice, { id: invoice.id });
    });
  }
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function maskIban(iban?: string | null): string | null {
  if (!iban) return null;
  const clean = iban.replace(/\s+/g, '');
  if (clean.length <= 8) return clean;
  return `${clean.slice(0, 4)} **** **** **** **** ${clean.slice(-4)}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
