import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Between, In } from 'typeorm';
import { Autofactura } from '../entities/autofactura.entity';
import { AutofacturaLine } from '../entities/autofactura-line.entity';
import { AutofacturaSource } from '../entities/autofactura-source.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { Invoice } from '../entities/invoice.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { AdminUser } from '../../users/entities/admin-user.entity';
import { resolveCompanyIdentity } from '../helpers/company-identity';
import { BillingScope } from './billing-access.service';

const r2 = (n: number) => Math.round((n || 0) * 100) / 100;

@Injectable()
export class AutofacturaService {
  constructor(
    @InjectRepository(Autofactura) private repo: Repository<Autofactura>,
    @InjectRepository(AutofacturaLine) private lineRepo: Repository<AutofacturaLine>,
    @InjectRepository(AutofacturaSource) private sourceRepo: Repository<AutofacturaSource>,
    @InjectRepository(Partner) private partnerRepo: Repository<Partner>,
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Employer) private employerRepo: Repository<Employer>,
    @InjectRepository(AdminUser) private adminUserRepo: Repository<AdminUser>,
    private dataSource: DataSource,
  ) {}

  async getContext(partnerPublicId?: string) {
    const company = await resolveCompanyIdentity(this.adminUserRepo);
    let partner: any = null;
    let nextNumber: string | null = null;
    if (partnerPublicId) {
      const p: any = await this.partnerRepo.findOne({ where: { publicId: partnerPublicId } });
      if (p) {
        const clean = (p.accountIban || '').replace(/\s+/g, '');
        partner = {
          id: p.publicId,
          name: p.name,
          taxId: p.taxId || p.nif || null,
          address: p.address,
          floorDoor: p.floorDoor,
          postalCode: p.postalCode,
          city: p.city,
          province: p.province,
          country: p.country,
          logoUrl: p.logoUrl,
          ibanMasked: clean ? `${clean.slice(0, 4)} **** **** **** ${clean.slice(-4)}` : null,
          retention: this.num(p.retention),
        };
        nextNumber = await this.nextNumber(p, new Date().toISOString().slice(0, 10));
      }
    }
    return { company, partner, nextNumber };
  }

  private num(v: any): number {
    if (v == null) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private prefix(name: string): string {
    const words = (name || '').trim().split(/\s+/).filter(Boolean);
    let p = words.map((w) => w[0]).join('').slice(0, 3).toUpperCase();
    if (p.length < 3) p = (name || '').replace(/\s+/g, '').slice(0, 3).toUpperCase();
    return p || 'AUT';
  }

  private groupLabel(subType?: string | null): string {
    if (subType === 'INDIVIDUAL') return 'Particulares';
    if (subType === 'COMPANY') return 'Empresas';
    if (subType === 'FREELANCER') return 'Autónomos';
    return 'Otros';
  }

  private async nextNumber(partner: Partner, issueDate: string): Promise<string> {
    const year = Number((issueDate || '').slice(0, 4)) || new Date().getFullYear();
    const count = await this.repo
      .createQueryBuilder('a')
      .where('a.partner_id = :pid', { pid: partner.id })
      .andWhere('EXTRACT(YEAR FROM a.issue_date) = :year', { year })
      .getCount();
    return `${this.prefix(partner.name)}-${year}-${String(count + 1).padStart(2, '0')}`;
  }

  private partnerBlock(p: any) {
    if (!p) return null;
    const clean = (p.accountIban || '').replace(/\s+/g, '');
    return {
      id: p.publicId,
      name: p.name,
      taxId: p.taxId || p.nif || null,
      address: p.address,
      floorDoor: p.floorDoor,
      postalCode: p.postalCode,
      city: p.city,
      province: p.province,
      country: p.country,
      logoUrl: p.logoUrl,
      ibanMasked: clean ? `${clean.slice(0, 4)} **** **** **** ${clean.slice(-4)}` : null,
    };
  }

  private map(a: Autofactura) {
    return {
      id: a.publicId,
      autofacturaNumber: a.autofacturaNumber,
      partnerId: a.partner?.publicId || null,
      partnerName: a.partner?.name || null,
      partner: this.partnerBlock(a.partner),
      issueDate: a.issueDate,
      periodStart: a.periodStart,
      periodEnd: a.periodEnd,
      paymentDate: a.paymentDate,
      subtotal: this.num(a.subtotal),
      retentionPct: this.num(a.retentionPct),
      retentionAmount: this.num(a.retentionAmount),
      vatPct: this.num(a.vatPct),
      vatAmount: this.num(a.vatAmount),
      total: this.num(a.total),
      status: a.status,
      isManual: a.isManual,
      notes: a.notes,
      lines: (a.lines || []).sort((x, y) => x.sortOrder - y.sortOrder).map((l) => ({ description: l.description, amount: this.num(l.amount) })),
      sources: (a.sources || []).map((s) => ({
        employerType: s.employerType,
        employerName: s.employerName,
        invoiceNumber: s.invoiceNumber,
        subtotal: this.num(s.subtotal),
        commission: this.num(s.commission),
        discount: this.num(s.discount),
        totalCommission: this.num(s.totalCommission),
      })),
    };
  }

  async list(scope: BillingScope) {
    if (scope.kind === 'employer') throw new ForbiddenException('No commission access for this role');
    const qb = this.repo.createQueryBuilder('a').leftJoinAndSelect('a.partner', 'partner').orderBy('a.issue_date', 'DESC').addOrderBy('a.autofactura_number', 'DESC');
    if (scope.kind === 'partner') qb.where('a.partner_id = :pid', { pid: scope.partnerId });
    const rows = await qb.getMany();
    return rows.map((a) => this.map(a));
  }

  async findByPublicId(publicId: string, scope?: BillingScope) {
    const a = await this.repo.findOne({ where: { publicId }, relations: ['partner', 'lines', 'sources'] });
    if (!a) throw new NotFoundException('Autofactura not found');
    if (scope?.kind === 'partner' && a.partnerId !== scope.partnerId) throw new ForbiddenException('Not allowed');
    if (scope?.kind === 'employer') throw new ForbiddenException('Not allowed');
    const hideEmployer = scope?.kind === 'partner' && (scope.partnerTier === 'Bronze' || scope.partnerTier === 'Affiliate');
    const mapped = this.map(a);
    if (hideEmployer) mapped.sources = [];
    const company = await resolveCompanyIdentity(this.adminUserRepo);
    return { ...mapped, company, hideEmployer };
  }

  private computeTotals(subtotal: number, retentionPct: number, vatPct: number) {
    const retentionAmount = r2(subtotal * (retentionPct / 100));
    const vatAmount = r2(subtotal * (vatPct / 100));
    const total = r2(subtotal - retentionAmount + vatAmount);
    return { retentionAmount, vatAmount, total };
  }

  async createManual(dto: {
    partnerId: string;
    issueDate?: string;
    periodStart: string;
    periodEnd: string;
    paymentDate?: string;
    vatPct?: number;
    notes?: string;
    lines: { description: string; amount: number }[];
  }) {
    const partner = await this.partnerRepo.findOne({ where: { publicId: dto.partnerId } });
    if (!partner) throw new NotFoundException('Partner not found');
    if (!dto.periodStart || !dto.periodEnd) throw new BadRequestException('A period is required');
    if (dto.periodEnd < dto.periodStart) throw new BadRequestException('End date must be on or after start date');
    const lines = (dto.lines || []).filter((l) => l.description?.trim());
    const subtotal = r2(lines.reduce((s, l) => s + this.num(l.amount), 0));
    const retentionPct = this.num(partner.retention);
    const vatPct = dto.vatPct != null ? this.num(dto.vatPct) : 21;
    const { retentionAmount, vatAmount, total } = this.computeTotals(subtotal, retentionPct, vatPct);
    const issueDate = dto.issueDate || new Date().toISOString().slice(0, 10);

    return this.dataSource.transaction(async (m) => {
      const af = m.create(Autofactura, {
        autofacturaNumber: await this.nextNumber(partner, issueDate),
        partnerId: partner.id,
        issueDate,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        paymentDate: dto.paymentDate || null,
        subtotal: String(subtotal),
        retentionPct: String(retentionPct),
        retentionAmount: String(retentionAmount),
        vatPct: String(vatPct),
        vatAmount: String(vatAmount),
        total: String(total),
        status: 'PENDING',
        isManual: true,
        notes: dto.notes || null,
      });
      const saved = await m.save(Autofactura, af);
      let i = 0;
      for (const l of lines) {
        await m.save(AutofacturaLine, m.create(AutofacturaLine, { autofacturaId: saved.id, description: l.description.trim(), amount: String(r2(this.num(l.amount))), sortOrder: i++ }));
      }
      const full = await m.findOne(Autofactura, { where: { id: saved.id }, relations: ['partner', 'lines', 'sources'] });
      return this.map(full!);
    });
  }

  async generateForPartner(partnerPublicId: string, periodStart: string, periodEnd: string, opts?: { skipIfEmpty?: boolean }) {
    const partner = await this.partnerRepo.findOne({ where: { publicId: partnerPublicId } });
    if (!partner) throw new NotFoundException('Partner not found');
    if (!periodStart || !periodEnd) throw new BadRequestException('A period is required');

    const employers = await this.employerRepo.find({ where: { partnerId: partner.id }, relations: ['subType'] });
    const empById = new Map(employers.map((e) => [e.id, e]));
    const employerIds = employers.map((e) => e.id);
    const invoices = employerIds.length
      ? await this.invoiceRepo.find({ where: { employerId: In(employerIds), periodStart: Between(periodStart, periodEnd) } })
      : [];

    const commissionPct = this.num(partner.commission);
    const sources: Partial<AutofacturaSource>[] = [];
    const groupTotals = new Map<string, { count: number; total: number }>();

    for (const inv of invoices) {
      if (String(inv.status).toUpperCase() === 'CANCELLED') continue;
      const emp: any = empById.get(inv.employerId);
      const base = this.num(inv.subtotal);
      const discountPct = this.num(emp?.discount);
      const commission = r2(base * (commissionPct / 100));
      const discount = r2(Math.min(base * (discountPct / 100), commission));
      const totalCommission = r2(commission - discount);
      const type = emp?.subType?.name || null;
      sources.push({
        employerType: type,
        employerName: emp?.name || `#${inv.employerId}`,
        invoiceNumber: inv.invoiceNumber,
        subtotal: String(base),
        commission: String(commission),
        discount: String(discount),
        totalCommission: String(totalCommission),
      });
      const key = type || 'OTHER';
      const g = groupTotals.get(key) || { count: 0, total: 0 };
      g.count += 1;
      g.total = r2(g.total + totalCommission);
      groupTotals.set(key, g);
    }

    const order = ['INDIVIDUAL', 'COMPANY', 'FREELANCER', 'OTHER'];
    const lines = [...groupTotals.entries()]
      .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
      .map(([type, g]) => ({ description: `Comisiones empleadores ${this.groupLabel(type)}: ${g.count}`, amount: g.total }));

    if (opts?.skipIfEmpty && sources.length === 0) return null;

    const subtotal = r2(lines.reduce((s, l) => s + l.amount, 0));
    const retentionPct = this.num(partner.retention);
    const vatPct = 21;
    const { retentionAmount, vatAmount, total } = this.computeTotals(subtotal, retentionPct, vatPct);
    const issueDate = new Date().toISOString().slice(0, 10);
    const [ey, em] = periodEnd.split('-').map(Number);
    const payMonth = em === 12 ? 1 : em + 1;
    const payYear = em === 12 ? ey + 1 : ey;
    const paymentDate = `${payYear}-${String(payMonth).padStart(2, '0')}-05`;

    return this.dataSource.transaction(async (mgr) => {
      const af = mgr.create(Autofactura, {
        autofacturaNumber: await this.nextNumber(partner, issueDate),
        partnerId: partner.id,
        issueDate,
        periodStart,
        periodEnd,
        paymentDate,
        subtotal: String(subtotal),
        retentionPct: String(retentionPct),
        retentionAmount: String(retentionAmount),
        vatPct: String(vatPct),
        vatAmount: String(vatAmount),
        total: String(total),
        status: 'PENDING',
        isManual: false,
      });
      const saved = await mgr.save(Autofactura, af);
      let i = 0;
      for (const l of lines) {
        await mgr.save(AutofacturaLine, mgr.create(AutofacturaLine, { autofacturaId: saved.id, description: l.description, amount: String(l.amount), sortOrder: i++ }));
      }
      for (const s of sources) {
        await mgr.save(AutofacturaSource, mgr.create(AutofacturaSource, { ...s, autofacturaId: saved.id }));
      }
      const full = await mgr.findOne(Autofactura, { where: { id: saved.id }, relations: ['partner', 'lines', 'sources'] });
      return this.map(full!);
    });
  }

  async generateMonthlyForAllPartners(periodStart: string, periodEnd: string): Promise<number> {
    const partners = await this.partnerRepo.find();
    let created = 0;
    for (const p of partners) {
      if (((p as any).nif || (p as any).taxId || '').toUpperCase() === 'SYSTEM') continue;
      const existing = await this.repo.findOne({ where: { partnerId: p.id, periodStart, isManual: false } });
      if (existing) continue;
      const res = await this.generateForPartner(p.publicId, periodStart, periodEnd, { skipIfEmpty: true });
      if (res) created++;
    }
    return created;
  }

  async markPaid(publicId: string) {
    const a = await this.repo.findOne({ where: { publicId } });
    if (!a) throw new NotFoundException('Autofactura not found');
    a.status = 'PAID';
    a.paidAt = new Date();
    await this.repo.save(a);
    return this.findByPublicId(publicId);
  }

  async cancel(publicId: string) {
    const a = await this.repo.findOne({ where: { publicId } });
    if (!a) throw new NotFoundException('Autofactura not found');
    a.status = 'CANCELLED';
    await this.repo.save(a);
    return this.findByPublicId(publicId);
  }

  async remove(publicId: string) {
    const a = await this.repo.findOne({ where: { publicId } });
    if (!a) throw new NotFoundException('Autofactura not found');
    if (a.status !== 'PENDING') throw new BadRequestException('Only pending autofacturas can be deleted');
    await this.repo.delete(a.id);
    return { isSuccess: true };
  }

  async loadEntity(publicId: string): Promise<Autofactura> {
    const a = await this.repo.findOne({ where: { publicId }, relations: ['partner', 'lines', 'sources'] });
    if (!a) throw new NotFoundException('Autofactura not found');
    return a;
  }

  async loadManyScoped(publicIds: string[], scope: BillingScope): Promise<Autofactura[]> {
    if (!publicIds?.length) return [];
    const rows = await this.repo.find({ where: { publicId: In(publicIds) }, relations: ['partner', 'lines', 'sources'], order: { issueDate: 'DESC' } });
    if (scope.kind === 'partner') return rows.filter((a) => a.partnerId === scope.partnerId);
    if (scope.kind === 'employer') return [];
    return rows;
  }
}
