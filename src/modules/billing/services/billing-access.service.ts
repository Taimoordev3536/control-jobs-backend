import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { PartnerUser } from '../../partners/entities/partner-user.entity';
import { Employer } from '../../employers/entities/employer.entity';

export interface BillingScope {
  /** "all" → admin, "partner" → only their employers, "employer" → only own. */
  kind: 'all' | 'partner' | 'employer';
  /** Set when kind === "partner" */
  partnerId?: number;
  /** Set when kind === "employer" */
  employerId?: number;
}

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
      });
      if (!link?.partnerId) {
        this.logger.warn(
          `Partner user #${userId} has no PartnerUser link — denying billing access`,
        );
        throw new ForbiddenException('Partner account not linked');
      }
      return { kind: 'partner', partnerId: link.partnerId };
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
}
