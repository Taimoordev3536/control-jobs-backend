import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { Invoice } from '../billing/entities/invoice.entity';
import { Autofactura } from '../billing/entities/autofactura.entity';
import { BankOperation } from '../billing/entities/bank-operation.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerInvitation } from '../employer-invitations/entities/employer-invitation.entity';
import { SupportTicket } from '../support/entities/support-ticket.entity';
import { Suggestion } from '../support/entities/suggestion.entity';
import { User } from '../users/entities/user.entity';
import { PendingEmployersService } from '../employers/services/pending-employers.service';
import { BillingAccessService } from '../billing/services/billing-access.service';
import { madridTodayKey } from '../../common/helpers/business-time';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Invoice) private invoiceRepo: Repository<Invoice>,
    @InjectRepository(Autofactura) private autofacturaRepo: Repository<Autofactura>,
    @InjectRepository(BankOperation) private bankOpRepo: Repository<BankOperation>,
    @InjectRepository(Employer) private employerRepo: Repository<Employer>,
    @InjectRepository(EmployerInvitation) private invitationRepo: Repository<EmployerInvitation>,
    @InjectRepository(SupportTicket) private ticketRepo: Repository<SupportTicket>,
    @InjectRepository(Suggestion) private suggestionRepo: Repository<Suggestion>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private readonly pendingEmployers: PendingEmployersService,
    private readonly billingAccess: BillingAccessService,
  ) {}

  async admin(user: any) {
    const today = madridTodayKey();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [pendingEmployers, openTickets, newSuggestions, bankTasks, overdueInvoices, latestInvoices, recentUsers] =
      await Promise.all([
        this.pendingEmployers.list(user).then((r) => r.counts.total).catch(() => 0),
        this.ticketRepo.count({ where: { status: 'OPEN' } }),
        this.suggestionRepo.count({ where: { createdAt: MoreThan(sevenDaysAgo) } }),
        this.bankOpRepo.count({ where: { status: 'PENDING', scopeType: 'ADMIN' } }),
        this.invoiceRepo
          .createQueryBuilder('i')
          .where(
            "i.status = 'OVERDUE' OR (i.status = 'PENDING' AND i.dueDate IS NOT NULL AND i.dueDate < :today)",
            { today },
          )
          .getCount(),
        this.invoiceRepo.find({ order: { createdAt: 'DESC' }, take: 5, relations: ['employer'] }),
        this.userRepo.find({ order: { createdAt: 'DESC' }, take: 5, relations: ['role'] }),
      ]);

    // Best-effort avatar resolution for recent signups (workers/clients/partners
    // store logo_url on their entity; employers/admins fall back to placeholder).
    const ids = recentUsers.map((u) => u.id).filter(Boolean);
    const avatarMap = new Map<number, string>();
    if (ids.length) {
      try {
        const rows: Array<{ id: number; avatar: string | null }> = await this.userRepo.query(
          `SELECT u.id::int AS id,
             COALESCE(w.logo_url, c.logo_url, p."logoUrl") AS avatar
           FROM cjobs_user u
           LEFT JOIN workers w ON w.user_id = u.id
           LEFT JOIN clients c ON c."userId" = u.id
           LEFT JOIN "cjobs_partnersUsuarios" pu ON pu.user_id = u.id
           LEFT JOIN cjobs_partners p ON p.id = pu.partner_id
           WHERE u.id = ANY($1)`,
          [ids],
        );
        for (const r of rows) if (r.avatar) avatarMap.set(Number(r.id), r.avatar);
      } catch {
        /* avatars are best-effort; placeholder fallback on the client */
      }
    }

    return {
      attention: { pendingEmployers, openTickets, newSuggestions, bankTasks, overdueInvoices },
      latestInvoices: latestInvoices.map((i) => ({
        id: i.publicId,
        number: i.invoiceNumber,
        employer: i.employer?.name || `#${i.employerId}`,
        total: Number(i.total) || 0,
        status: i.status,
        date: i.issueDate,
      })),
      recentSignups: recentUsers.map((u) => ({
        name: u.name,
        role: (u.role?.name || '').toLowerCase(),
        at: u.createdAt,
        avatar: avatarMap.get(u.id) || null,
      })),
    };
  }

  async partner(user: any) {
    const scope = await this.billingAccess.resolveScope(user);
    if (scope.kind !== 'partner' || !scope.partnerId) {
      throw new ForbiddenException('Not a partner');
    }
    const partnerId = scope.partnerId;
    const monthStart = madridTodayKey().slice(0, 7) + '-01';

    const [commissionRow, pendingRow, commissionToCollect, activeEmployers, pendingInvitations, recentEmployers] =
      await Promise.all([
        this.autofacturaRepo
          .createQueryBuilder('a')
          .select('COALESCE(SUM(a.total), 0)', 'sum')
          .where('a.partner_id = :partnerId', { partnerId })
          .andWhere("a.status != 'CANCELLED'")
          .andWhere('a.issueDate >= :monthStart', { monthStart })
          .getRawOne<{ sum: string }>(),
        this.autofacturaRepo
          .createQueryBuilder('a')
          .select('COALESCE(SUM(a.total), 0)', 'sum')
          .where('a.partner_id = :partnerId', { partnerId })
          .andWhere("a.status = 'PENDING'")
          .getRawOne<{ sum: string }>(),
        this.autofacturaRepo.count({ where: { partnerId, status: 'PENDING' } }),
        this.employerRepo.count({ where: { partnerId, billingStatus: In(['TRIAL', 'ACTIVE']) as any } }),
        this.invitationRepo.count({ where: { partnerId, status: 'PENDING' } }),
        this.employerRepo.find({ where: { partnerId }, order: { createdAt: 'DESC' }, take: 6, relations: ['subType'] }),
      ]);

    return {
      tier: scope.partnerTier || null,
      business: {
        commissionThisMonth: Number(commissionRow?.sum) || 0,
        pendingCollection: Number(pendingRow?.sum) || 0,
        activeEmployers,
      },
      attention: { pendingInvitations, commissionToCollect },
      employers: recentEmployers.map((e) => ({
        id: e.publicId,
        name: e.name,
        sector: (e as any).subType?.name || null,
        status: e.billingStatus,
        at: e.createdAt,
      })),
    };
  }
}
