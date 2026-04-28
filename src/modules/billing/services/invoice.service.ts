import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Invoice, InvoiceStatus } from '../entities/invoice.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { EmployerWorker } from '../../employers/entities/employer-worker.entity';
import { EmployerWorkCenter } from '../../employers/entities/employer-work-center.entity';
import { AdminConfig } from '../../admin/entities/admin-config.entity';
import { PricingService } from './pricing.service';

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
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    @InjectRepository(EmployerWorker)
    private readonly employerWorkerRepo: Repository<EmployerWorker>,
    @InjectRepository(EmployerWorkCenter)
    private readonly employerWorkCenterRepo: Repository<EmployerWorkCenter>,
    @InjectRepository(AdminConfig)
    private readonly adminConfigRepo: Repository<AdminConfig>,
    private readonly pricing: PricingService,
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
    const issueDate = options.issueDate ?? new Date();
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

    const isProrated =
      typeof options.proratedDays === 'number' &&
      typeof options.daysInMonth === 'number' &&
      options.proratedDays !== options.daysInMonth;

    const breakdown = this.pricing.calculate({
      monthlyFixed: Number(employer.monthlyFixedRate) || 0,
      perWorkCenter: Number(employer.perWorkCenterRate) || 0,
      perWorker: Number(employer.perWorkerRate) || 0,
      workCenters: workCenterCount,
      workers: workerCount,
      discountPct: Number(employer.discount) || 0,
      vatPct,
      proratedDays: isProrated ? options.proratedDays : undefined,
      daysInMonth: isProrated ? options.daysInMonth : undefined,
    });

    return await this.invoiceRepo.manager.transaction(async (manager) => {
      const invoiceNumber = await this.generateInvoiceNumber(
        manager,
        adminConfig.length ? adminConfig[0].invoiceSeries : 'CJ',
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
        monthlyFixedRate: Number(employer.monthlyFixedRate) || 0,
        perWorkCenterRate: Number(employer.perWorkCenterRate) || 0,
        perWorkerRate: Number(employer.perWorkerRate) || 0,
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
      this.logger.log(
        `Invoice ${saved.invoiceNumber} created for employer ${employer.id} (${breakdown.total} EUR)`,
      );
      return saved;
    });
  }

  /**
   * Build the next invoice number for a (series, year, month) bucket.
   * Format: SERIES-YYYY-MM-NNNNNN. Resets each month.
   */
  private async generateInvoiceNumber(
    manager: EntityManager,
    series: string,
    issueDate: Date,
  ): Promise<string> {
    const yyyy = issueDate.getFullYear();
    const mm = String(issueDate.getMonth() + 1).padStart(2, '0');
    const prefix = `${series}-${yyyy}-${mm}-`;

    // Largest existing sequence in this bucket (lock the row range with FOR UPDATE).
    const result = await manager.query(
      `SELECT invoice_number FROM cjobs_invoices
        WHERE invoice_number LIKE $1
        ORDER BY invoice_number DESC
        LIMIT 1
        FOR UPDATE`,
      [`${prefix}%`],
    );

    let next = 1;
    if (result.length > 0) {
      const last = String(result[0].invoice_number);
      const tail = parseInt(last.slice(prefix.length), 10);
      if (Number.isFinite(tail)) next = tail + 1;
    }
    return `${prefix}${String(next).padStart(6, '0')}`;
  }

  /** Look up an invoice by publicId or fail. */
  async findByPublicId(publicId: string): Promise<Invoice> {
    const invoice = await this.invoiceRepo.findOne({ where: { publicId } });
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
      .addOrderBy('inv.id', 'DESC')
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
    if (options.status) {
      qb.andWhere('inv.status = :status', { status: options.status });
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize };
  }

  async markPaid(publicId: string): Promise<Invoice> {
    const invoice = await this.findByPublicId(publicId);
    invoice.status = 'PAID';
    invoice.paidAt = new Date();
    return this.invoiceRepo.save(invoice);
  }

  async cancel(publicId: string): Promise<Invoice> {
    const invoice = await this.findByPublicId(publicId);
    invoice.status = 'CANCELLED';
    return this.invoiceRepo.save(invoice);
  }
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
