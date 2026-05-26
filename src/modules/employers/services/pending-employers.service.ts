import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { EmployerInvitation } from '../../employer-invitations/entities/employer-invitation.entity';
import { Employer } from '../entities/employer.entity';
import { EmployerUser } from '../entities/employer-user.entity';
import { PartnerUser } from '../../partners/entities/partner-user.entity';
import { EmailVerificationService } from '../../../common/services/email-verification.service';

export type PendingItemKind = 'invitation' | 'unverified';

export type PendingItemStatus =
  | 'INVITATION_SENT'
  | 'EXPIRED'
  | 'REVOKED'
  | 'AWAITING_EMAIL_VERIFICATION';

export interface PendingItem {
  kind: PendingItemKind;
  /** publicId of the invitation OR employer, depending on `kind` */
  publicId: string;
  /** recipient email (best-known) */
  email: string | null;
  partnerId: number | null;
  partnerName: string | null;
  status: PendingItemStatus;
  /** when the invitation was created OR when the employer record was created */
  sentAt: Date;
  /** invitation expiry, when applicable */
  expiresAt: Date | null;
  /** invitation description, when applicable */
  description: string | null;
  /** employer name, only set when kind === 'unverified' */
  employerName: string | null;
}

export interface PendingListResponse {
  data: PendingItem[];
  counts: {
    total: number;
    invitationSent: number;
    awaitingEmailVerification: number;
    expired: number;
    revoked: number;
  };
}

@Injectable()
export class PendingEmployersService {
  constructor(
    @InjectRepository(EmployerInvitation)
    private readonly invitationRepo: Repository<EmployerInvitation>,
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    @InjectRepository(EmployerUser)
    private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(PartnerUser)
    private readonly partnerUserRepo: Repository<PartnerUser>,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  async list(requester: any): Promise<PendingListResponse> {
    const role = String(requester?.role?.name || '').toLowerCase();

    let partnerScope: number | null = null;
    if (role === 'admin') {
      partnerScope = null;
    } else if (role === 'partner') {
      const link = await this.partnerUserRepo.findOne({
        where: { userId: requester.id },
      });
      if (!link?.partnerId) {
        return this.emptyResponse();
      }
      partnerScope = link.partnerId;
    } else {
      throw new ForbiddenException('Only admin or partner can view pending employers');
    }

    const [invitationItems, unverifiedItems] = await Promise.all([
      this.fetchUnredeemedInvitations(partnerScope),
      this.fetchUnverifiedEmployers(partnerScope),
    ]);

    const data = [...invitationItems, ...unverifiedItems].sort(
      (a, b) => b.sentAt.getTime() - a.sentAt.getTime(),
    );

    return {
      data,
      counts: {
        total: data.length,
        invitationSent: data.filter((i) => i.status === 'INVITATION_SENT').length,
        awaitingEmailVerification: data.filter(
          (i) => i.status === 'AWAITING_EMAIL_VERIFICATION',
        ).length,
        expired: data.filter((i) => i.status === 'EXPIRED').length,
        revoked: data.filter((i) => i.status === 'REVOKED').length,
      },
    };
  }

  private async fetchUnredeemedInvitations(
    partnerId: number | null,
  ): Promise<PendingItem[]> {
    const qb = this.invitationRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.partner', 'partner')
      .leftJoin('inv.redemptions', 'redemption')
      .where('redemption.id IS NULL')
      .orderBy('inv.createdAt', 'DESC');

    if (partnerId !== null) {
      qb.andWhere('inv.partnerId = :pid', { pid: partnerId });
    }

    const rows = await qb.getMany();
    const now = Date.now();

    return rows.map((inv): PendingItem => {
      let status: PendingItemStatus;
      if (inv.status === 'REVOKED') {
        status = 'REVOKED';
      } else if (
        inv.status === 'EXPIRED' ||
        (inv.expiresAt && inv.expiresAt.getTime() < now)
      ) {
        status = 'EXPIRED';
      } else {
        status = 'INVITATION_SENT';
      }
      return {
        kind: 'invitation',
        publicId: inv.publicId,
        email: inv.email,
        partnerId: inv.partnerId,
        partnerName: inv.partner?.name ?? null,
        status,
        sentAt: inv.createdAt,
        expiresAt: inv.expiresAt,
        description: inv.description || null,
        employerName: null,
      };
    });
  }

  private async fetchUnverifiedEmployers(
    partnerId: number | null,
  ): Promise<PendingItem[]> {
    const where: any = { user: { emailVerifiedAt: IsNull() } };
    if (partnerId !== null) {
      where.employer = { partnerId };
    }

    const links = await this.employerUserRepo.find({
      where,
      relations: ['employer', 'employer.partner', 'user'],
    });

    return links
      .filter((link) => link.employer && link.user)
      .map((link): PendingItem => ({
        kind: 'unverified',
        publicId: link.employer.publicId,
        email: link.user.email,
        partnerId: link.employer.partnerId,
        partnerName: link.employer.partner?.name ?? null,
        status: 'AWAITING_EMAIL_VERIFICATION',
        sentAt: link.user.createdAt ?? link.createdAt,
        expiresAt: null,
        description: null,
        employerName: link.employer.name,
      }));
  }

  /**
   * Re-send the email verification link to the default user of an employer.
   * Used by the pending-employers UI for rows in 'AWAITING_EMAIL_VERIFICATION'.
   * Partners can only resend for employers in their own scope.
   */
  async resendVerification(
    requester: any,
    employerPublicId: string,
  ): Promise<{ sent: boolean }> {
    const role = String(requester?.role?.name || '').toLowerCase();

    const employer = await this.employerRepo.findOne({
      where: { publicId: employerPublicId },
    });
    if (!employer) throw new NotFoundException('Employer not found');

    if (role === 'partner') {
      const link = await this.partnerUserRepo.findOne({
        where: { userId: requester.id },
      });
      if (!link?.partnerId || link.partnerId !== employer.partnerId) {
        throw new ForbiddenException(
          'Cannot resend verification for an employer outside your partner scope',
        );
      }
    } else if (role !== 'admin') {
      throw new ForbiddenException('Only admin or partner can resend verification');
    }

    const eu = await this.employerUserRepo.findOne({
      where: { employer: { id: employer.id } },
      relations: ['user'],
    });
    if (!eu?.user) {
      throw new BadRequestException('No user linked to this employer');
    }
    if (eu.user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }
    await this.emailVerificationService.resend(eu.user.email);
    return { sent: true };
  }

  private emptyResponse(): PendingListResponse {
    return {
      data: [],
      counts: {
        total: 0,
        invitationSent: 0,
        awaitingEmailVerification: 0,
        expired: 0,
        revoked: 0,
      },
    };
  }
}
