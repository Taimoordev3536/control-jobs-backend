import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { BankOperation } from '../entities/bank-operation.entity';
import { Invoice } from '../entities/invoice.entity';
import { Autofactura } from '../entities/autofactura.entity';
import { ClientInvoice } from '../../clients/entities/client-invoice.entity';
import { SalaryReceipt } from '../../workers/entities/salary-receipt.entity';
import { BillingScope } from './billing-access.service';

type Tab = 'FACTURAS' | 'COMISIONES' | 'SALARIOS';

@Injectable()
export class BankOperationsService {
  constructor(
    @InjectRepository(BankOperation) private repo: Repository<BankOperation>,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Autofactura) private autofacturaRepo: Repository<Autofactura>,
    @InjectRepository(ClientInvoice) private clientInvoiceRepo: Repository<ClientInvoice>,
    @InjectRepository(SalaryReceipt) private salaryRepo: Repository<SalaryReceipt>,
  ) {}

  private num(v: any): number {
    return v != null ? Number(v) : 0;
  }

  private tabsFor(scope: BillingScope): Tab[] {
    if (scope.kind === 'all') return ['FACTURAS', 'COMISIONES'];
    if (scope.kind === 'employer') return ['FACTURAS', 'SALARIOS'];
    return [];
  }

  private assertTab(scope: BillingScope, tab: Tab) {
    if (!this.tabsFor(scope).includes(tab)) throw new ForbiddenException('Tab not allowed for this role');
  }

  private map(o: BankOperation) {
    return {
      id: o.publicId,
      scopeType: o.scopeType,
      tab: o.tab,
      kind: o.kind,
      periodStart: o.periodStart,
      periodEnd: o.periodEnd,
      itemCount: o.itemCount,
      totalAmount: this.num(o.totalAmount),
      source: o.source,
      status: o.status,
      notes: o.notes,
      doneAt: o.doneAt,
      createdAt: o.createdAt,
    };
  }

  async list(scope: BillingScope, tab: Tab) {
    this.assertTab(scope, tab);
    const where: any = { tab };
    if (scope.kind === 'all') where.scopeType = 'ADMIN';
    else {
      where.scopeType = 'EMPLOYER';
      where.employerId = scope.employerId;
    }
    const rows = await this.repo.find({ where, order: { createdAt: 'DESC' } });
    return rows.map((r) => this.map(r));
  }

  /** Summarise the period's documents for a tab into a single bank task. */
  private async summarise(scope: BillingScope, tab: Tab, periodStart: string, periodEnd: string) {
    const range = Between(periodStart, periodEnd) as any;
    if (scope.kind === 'all') {
      if (tab === 'FACTURAS') {
        const rows = await this.invoiceRepo.find({ where: { periodStart: range, status: 'PENDING' as any } });
        return { kind: 'COBRO' as const, items: rows, total: rows.reduce((s, r) => s + this.num(r.total), 0), refIds: rows.map((r) => r.publicId) };
      }
      const rows = await this.autofacturaRepo.find({ where: { periodStart: range, status: 'PENDING' as any } });
      return { kind: 'PAGO' as const, items: rows, total: rows.reduce((s, r) => s + this.num(r.total), 0), refIds: rows.map((r) => r.publicId) };
    }
    // employer
    if (tab === 'FACTURAS') {
      const rows = await this.clientInvoiceRepo.find({ where: { employerId: scope.employerId, periodStart: range } });
      return { kind: 'COBRO' as const, items: rows, total: rows.reduce((s, r) => s + this.num(r.total), 0), refIds: rows.map((r) => r.publicId) };
    }
    const rows = await this.salaryRepo.find({ where: { employerId: scope.employerId, periodStart: range } });
    return { kind: 'PAGO' as const, items: rows, total: rows.reduce((s, r) => s + this.num(r.total), 0), refIds: rows.map((r) => r.publicId) };
  }

  async closeMonth(scope: BillingScope, tab: Tab, periodStart: string, periodEnd: string, source: 'AUTO' | 'MANUAL' = 'MANUAL') {
    this.assertTab(scope, tab);
    if (!periodStart || !periodEnd) throw new BadRequestException('A period is required');
    const s = await this.summarise(scope, tab, periodStart, periodEnd);
    if (!s.items.length) return null;
    const op = this.repo.create({
      scopeType: scope.kind === 'all' ? 'ADMIN' : 'EMPLOYER',
      employerId: scope.kind === 'employer' ? scope.employerId! : null,
      tab,
      kind: s.kind,
      periodStart,
      periodEnd,
      itemCount: s.items.length,
      totalAmount: String(Math.round(s.total * 100) / 100),
      source,
      status: 'PENDING',
      refIds: s.refIds,
    });
    const saved = await this.repo.save(op);
    return this.map(saved);
  }

  /** Record a bank task from a manual selection (e.g. the commission bank-batch). */
  async record(params: {
    scope: BillingScope;
    tab: Tab;
    kind: 'COBRO' | 'PAGO';
    periodStart: string;
    periodEnd: string;
    refIds: string[];
    total: number;
    source?: 'AUTO' | 'MANUAL';
  }) {
    const op = this.repo.create({
      scopeType: params.scope.kind === 'all' ? 'ADMIN' : 'EMPLOYER',
      employerId: params.scope.kind === 'employer' ? params.scope.employerId! : null,
      tab: params.tab,
      kind: params.kind,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      itemCount: params.refIds.length,
      totalAmount: String(Math.round(params.total * 100) / 100),
      source: params.source || 'MANUAL',
      status: 'PENDING',
      refIds: params.refIds,
    });
    return this.map(await this.repo.save(op));
  }

  private async loadScoped(publicId: string, scope: BillingScope) {
    const o = await this.repo.findOne({ where: { publicId } });
    if (!o) throw new NotFoundException('Bank operation not found');
    if (scope.kind === 'all' && o.scopeType !== 'ADMIN') throw new ForbiddenException('Not allowed');
    if (scope.kind === 'employer' && (o.scopeType !== 'EMPLOYER' || Number(o.employerId) !== Number(scope.employerId))) throw new ForbiddenException('Not allowed');
    if (scope.kind === 'partner') throw new ForbiddenException('Not allowed');
    return o;
  }

  async markDone(publicId: string, scope: BillingScope) {
    const o = await this.loadScoped(publicId, scope);
    o.status = 'DONE';
    o.doneAt = new Date();
    return this.map(await this.repo.save(o));
  }

  async remove(publicId: string, scope: BillingScope) {
    const o = await this.loadScoped(publicId, scope);
    await this.repo.delete(o.id);
    return { isSuccess: true };
  }
}
