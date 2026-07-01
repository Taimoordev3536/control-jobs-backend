import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { PartnerUser } from '../../partners/entities/partner-user.entity';
import { PartnerTier } from '../../partners/entities/partner-type.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { Employer } from '../../employers/entities/employer.entity';

export type PartnerTierName = 'Gold' | 'Silver' | 'Bronze' | 'Affiliate';

export interface BillingScope {
  /** "all" → admin, "partner" → only their employers, "employer" → only own. */
  kind: 'all' | 'partner' | 'employer';
  /** Set when kind === "partner" */
  partnerId?: number;
  /** Set when kind === "employer" */
  employerId?: number;
  /** Set when kind === "partner" — gates how much of an invoice they can see. */
  partnerTier?: PartnerTierName;
}

/**
 * How much of an invoice the caller is allowed to see.
 *  - 'full'      → page 1 + page 2 (worksite & worker names)
 *  - 'page1Only' → only the financial breakdown; snapshots stripped
 */
export type InvoiceDetailLevel = 'full' | 'page1Only';

/**
 * Resolves which invoices/employers an authenticated user is allowed to see
 * for the billing module. Centralised so list/getOne/preview share one rule.
 */
@Injectable()
export class BillingAccessService {
  private readonly logger = new Logger(BillingAccessService.name);

  constructor(
    @InjectRepository(EmployerUser)
    private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(PartnerUser)
    private readonly partnerUserRepo: Repository<PartnerUser>,
    @InjectRepository(PartnerTier)
    private readonly partnerTierRepo: Repository<PartnerTier>,
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
  ) {}

  /**
   * Build the scope object from the JWT-decoded user. Sub-users inherit
   * their parent's scope by walking parent_user_id.
   */
  async resolveScope(user: any): Promise<BillingScope> {
    const userId = Number(user?.id);
    const roleName = String(user?.role?.name || '').toLowerCase();

    if (!userId) {
      this.logger.warn('resolveScope: missing user id on req.user');
      throw new ForbiddenException('Authentication required');
    }

    if (roleName === 'admin') {
      return { kind: 'all' };
    }

    if (roleName === 'partner') {
      // Find any PartnerUser link for this user (default OR sub-user).
      const link = await this.partnerUserRepo.findOne({
        where: { userId },
        relations: ['partner'],
      });
      if (!link?.partnerId) {
        this.logger.warn(
          `Partner user #${userId} has no PartnerUser link — denying billing access`,
        );
        throw new ForbiddenException('Partner account not linked');
      }
      // Resolve tier name (Gold / Silver / Bronze / Affiliate). Drives
      // invoice-detail visibility per spec §3.
      const partner = (link as any).partner as Partner | undefined;
      let tierName: PartnerTierName | undefined;
      if (partner?.partnerTierId) {
        const tier = await this.partnerTierRepo.findOne({
          where: { id: partner.partnerTierId },
        });
        const raw = (tier?.name || '').trim();
        if (
          raw === 'Gold' ||
          raw === 'Silver' ||
          raw === 'Bronze' ||
          raw === 'Affiliate'
        ) {
          tierName = raw;
        }
      }
      return {
        kind: 'partner',
        partnerId: link.partnerId,
        partnerTier: tierName,
      };
    }

    if (roleName === 'employer') {
      // EmployerUser has no explicit userId column, but TypeORM creates the
      // FK as `userId` by convention. Use a QueryBuilder to be explicit.
      const link = await this.employerUserRepo
        .createQueryBuilder('eu')
        .leftJoinAndSelect('eu.employer', 'employer')
        .where('eu."userId" = :userId', { userId })
        .getOne();
      const employerId = link?.employer?.id;
      if (!employerId) {
        this.logger.warn(
          `Employer user #${userId} has no EmployerUser link — denying billing access`,
        );
        throw new ForbiddenException('Employer account not linked');
      }
      return { kind: 'employer', employerId };
    }

    this.logger.warn(`No billing access for role "${roleName}" (user #${userId})`);
    throw new ForbiddenException('No billing access for this role');
  }

  /**
   * Throw if the resolved scope cannot view the given employer's data.
   */
  async assertCanViewEmployer(
    scope: BillingScope,
    employerId: number,
  ): Promise<void> {
    if (scope.kind === 'all') return;
    if (scope.kind === 'employer') {
      if (scope.employerId !== employerId) {
        throw new ForbiddenException('Not allowed to view this employer');
      }
      return;
    }
    if (scope.kind === 'partner') {
      const employer = await this.employerRepo.findOne({
        where: { id: employerId },
      });
      if (!employer) throw new ForbiddenException('Employer not found');
      if (employer.partnerId !== scope.partnerId) {
        throw new ForbiddenException('Not allowed to view this employer');
      }
    }
  }

  isAdmin(user: any): boolean {
    return String(user?.role?.name || '').toLowerCase() === 'admin';
  }

  /**
   * Tier-aware gate for the invoice DETAIL surface (web page + PDF).
   * Layered on top of the basic employer-scoping check:
   *   - admin / employer (own) → full
   *   - partner Gold | Silver  → full
   *   - partner Bronze         → page 1 only (snapshots stripped from response)
   *   - partner Affiliate      → 403, can only see the listing
   */
  async assertInvoiceDetailAccess(
    scope: BillingScope,
    employerId: number,
  ): Promise<InvoiceDetailLevel> {
    await this.assertCanViewEmployer(scope, employerId);

    if (scope.kind === 'partner') {
      // Per spec: Bronze AND Affiliate see only page 1 (no worksite/worker page 2)
      // and with the employer's data hidden (see hidesEmployer).
      if (scope.partnerTier === 'Bronze' || scope.partnerTier === 'Affiliate') {
        return 'page1Only';
      }
    }
    return 'full';
  }

  /**
   * Whether the caller must NOT see the employer's identity/data on invoices and
   * commission self-invoices. True for Bronze & Affiliate partners (spec p9).
   */
  hidesEmployer(scope: BillingScope): boolean {
    return (
      scope.kind === 'partner' &&
      (scope.partnerTier === 'Bronze' || scope.partnerTier === 'Affiliate')
    );
  }
}
