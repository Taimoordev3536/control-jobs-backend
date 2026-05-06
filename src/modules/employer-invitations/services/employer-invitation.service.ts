import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmployerInvitation, InvitationStatus } from '../entities/employer-invitation.entity';
import { EmployerInvitationRedemption } from '../entities/employer-invitation-redemption.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { PartnerUser } from '../../partners/entities/partner-user.entity';
import { User } from '../../users/entities/user.entity';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { EmployersService } from '../../employers/employers.service';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';

const TOKEN_TYPE = 'employer-invite';

interface TokenPayload {
  type: typeof TOKEN_TYPE;
  invitationId: number;
  partnerId: number;
  trialDays: number;
  discountPercent: number;
  description: string;
  issuedByUserId: number;
}

export interface InvitationWithMeta extends EmployerInvitation {
  inviteLink?: string;
  acceptedCount?: number;
}

@Injectable()
export class EmployerInvitationService {
  private readonly logger = new Logger(EmployerInvitationService.name);

  constructor(
    @InjectRepository(EmployerInvitation)
    private readonly invitationRepo: Repository<EmployerInvitation>,
    @InjectRepository(EmployerInvitationRedemption)
    private readonly redemptionRepo: Repository<EmployerInvitationRedemption>,
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(PartnerUser)
    private readonly partnerUserRepo: Repository<PartnerUser>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(EmployerUser)
    private readonly employerUserRepo: Repository<EmployerUser>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly employersService: EmployersService,
  ) {}

  // ============================================================
  // Public API methods called by the controller
  // ============================================================

  /**
   * Issue a new bulk invitation link. The same link can be redeemed by
   * many users until it expires or is revoked.
   */
  async create(
    requester: any,
    dto: CreateInvitationDto,
  ): Promise<{ invitation: EmployerInvitation; inviteLink: string }> {
    const role = String(requester?.role?.name || '').toLowerCase();
    if (role !== 'admin' && role !== 'partner') {
      throw new ForbiddenException('Only admin or partner can issue invitations');
    }

    let partnerId = dto.partnerId;
    if (role === 'partner') {
      const link = await this.partnerUserRepo.findOne({
        where: { userId: requester.id },
      });
      if (!link?.partnerId) {
        throw new ForbiddenException('Partner account not linked');
      }
      partnerId = link.partnerId;
    }
    if (!partnerId) {
      throw new BadRequestException('partnerId is required for admin');
    }

    const partner = await this.partnerRepo.findOne({ where: { id: partnerId } });
    if (!partner) throw new NotFoundException('Partner not found');

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const invitation = this.invitationRepo.create({
      description: dto.description,
      partnerId,
      discountPercent: dto.discountPercent,
      trialDays: dto.trialDays,
      maxRedemptions: dto.maxRedemptions ?? null,
      issuedByUserId: requester.id,
      status: 'PENDING' as InvitationStatus,
      expiresAt,
    });
    const saved = await this.invitationRepo.save(invitation);

    const token = this.signToken(
      {
        type: TOKEN_TYPE,
        invitationId: saved.id,
        partnerId,
        trialDays: dto.trialDays,
        discountPercent: dto.discountPercent,
        description: dto.description,
        issuedByUserId: requester.id,
      },
      expiresAt,
    );
    const inviteLink = this.buildLink(token);

    return { invitation: saved, inviteLink };
  }

  /**
   * List invitations sent by the current user (or all, for admin).
   * Each row carries an `acceptedCount` aggregated from the redemption
   * table and — for still-active rows — a freshly-signed inviteLink.
   */
  async list(requester: any): Promise<InvitationWithMeta[]> {
    const role = String(requester?.role?.name || '').toLowerCase();

    const qb = this.invitationRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.partner', 'partner')
      .loadRelationCountAndMap('inv.acceptedCount', 'inv.redemptions')
      .orderBy('inv.createdAt', 'DESC');

    if (role === 'admin') {
      // sees all
    } else if (role === 'partner') {
      const link = await this.partnerUserRepo.findOne({
        where: { userId: requester.id },
      });
      if (!link?.partnerId) return [];
      qb.where('inv.partnerId = :pid', { pid: link.partnerId });
    } else {
      throw new ForbiddenException('Only admin or partner can view invitations');
    }

    const rows = (await qb.getMany()) as InvitationWithMeta[];

    return rows.map((inv) => {
      const isActive =
        inv.status === 'PENDING' &&
        (!inv.expiresAt || inv.expiresAt.getTime() > Date.now());
      if (!isActive) return inv;

      const expiresInSec = inv.expiresAt
        ? Math.max(60, Math.floor((inv.expiresAt.getTime() - Date.now()) / 1000))
        : undefined;

      const token = this.jwtService.sign(
        {
          type: TOKEN_TYPE,
          invitationId: inv.id,
          partnerId: inv.partnerId,
          trialDays: inv.trialDays,
          discountPercent: Number(inv.discountPercent),
          description: inv.description,
          issuedByUserId: inv.issuedByUserId,
        },
        expiresInSec ? { expiresIn: expiresInSec } : {},
      );
      return Object.assign(inv, { inviteLink: this.buildLink(token) });
    });
  }

  /**
   * List redemptions for one invitation — used by the "Aceptadas"
   * drawer in the admin UI.
   */
  async listRedemptions(
    requester: any,
    publicId: string,
  ): Promise<EmployerInvitationRedemption[]> {
    const role = String(requester?.role?.name || '').toLowerCase();
    const inv = await this.invitationRepo.findOne({ where: { publicId } });
    if (!inv) throw new NotFoundException('Invitation not found');

    if (role === 'partner') {
      const link = await this.partnerUserRepo.findOne({
        where: { userId: requester.id },
      });
      if (!link?.partnerId || link.partnerId !== inv.partnerId) {
        throw new ForbiddenException('Not your invitation');
      }
    } else if (role !== 'admin') {
      throw new ForbiddenException('Only admin or partner can view redemptions');
    }

    return this.redemptionRepo.find({
      where: { invitationId: inv.id },
      order: { redeemedAt: 'DESC' },
    });
  }

  /**
   * Verify a token without consuming it. Used by the accept page to
   * pre-fill the partner name, description, discount, trial.
   */
  async verify(token: string): Promise<{
    valid: boolean;
    reason?: string;
    description?: string;
    partnerId?: number;
    partnerName?: string;
    discountPercent?: number;
    trialDays?: number;
  }> {
    const payload = this.verifyToken(token);
    if (!payload) return { valid: false, reason: 'invalid' };

    const invitation = await this.invitationRepo.findOne({
      where: { id: payload.invitationId },
    });
    if (!invitation) return { valid: false, reason: 'not_found' };
    if (invitation.status === 'REVOKED') return { valid: false, reason: 'revoked' };
    if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
      invitation.status = 'EXPIRED' as InvitationStatus;
      await this.invitationRepo.save(invitation);
      return { valid: false, reason: 'expired' };
    }

    if (invitation.maxRedemptions !== null) {
      const used = await this.redemptionRepo.count({
        where: { invitationId: invitation.id },
      });
      if (used >= invitation.maxRedemptions) {
        return { valid: false, reason: 'max_reached' };
      }
    }

    const partner = await this.partnerRepo.findOne({ where: { id: payload.partnerId } });
    if (!partner) return { valid: false, reason: 'partner_missing' };

    return {
      valid: true,
      description: invitation.description,
      partnerId: invitation.partnerId,
      partnerName: partner.name,
      discountPercent: Number(invitation.discountPercent),
      trialDays: invitation.trialDays,
    };
  }

  /**
   * Redeem the invitation: create User + Employer + EmployerUser link
   * and record a redemption row. The invitation itself stays ACTIVE so
   * other recipients can also redeem.
   */
  async accept(dto: AcceptInvitationDto): Promise<{ employerId: number; userId: number }> {
    const payload = this.verifyToken(dto.token);
    if (!payload) throw new UnauthorizedException('Invalid invitation token');

    const invitation = await this.invitationRepo.findOne({
      where: { id: payload.invitationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status === 'REVOKED') {
      throw new BadRequestException('Invitation revoked');
    }
    if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
      invitation.status = 'EXPIRED' as InvitationStatus;
      await this.invitationRepo.save(invitation);
      throw new BadRequestException('Invitation expired');
    }
    // Defence in depth: cross-check partner & trial against the token.
    if (invitation.partnerId !== payload.partnerId) {
      throw new BadRequestException('Partner mismatch');
    }
    if (invitation.trialDays !== payload.trialDays) {
      throw new BadRequestException('Trial mismatch');
    }

    if (invitation.maxRedemptions !== null) {
      const used = await this.redemptionRepo.count({
        where: { invitationId: invitation.id },
      });
      if (used >= invitation.maxRedemptions) {
        throw new BadRequestException('Invitation has reached its redemption limit');
      }
    }

    const emailLower = dto.email.trim().toLowerCase();

    const dup = await this.redemptionRepo.findOne({
      where: { invitationId: invitation.id, redeemedEmail: emailLower },
    });
    if (dup) {
      throw new BadRequestException(
        'This email already redeemed this invitation. Please log in instead.',
      );
    }

    const existingUser = await this.userRepo.findOne({ where: { email: emailLower } });
    if (existingUser) {
      throw new BadRequestException(
        'An account already exists with this email. Please log in.',
      );
    }

    const result = await this.employersService.create({
      name: dto.name,
      taxId: dto.taxId,
      address: dto.address,
      street: dto.street,
      streetNumber: dto.streetNumber,
      floorDoor: dto.floorDoor,
      postalCode: dto.postalCode,
      city: dto.city,
      province: dto.province,
      country: dto.country,
      latitude: dto.latitude,
      longitude: dto.longitude,
      partnerId: String(payload.partnerId),
      phone: dto.phone,
      mobile: dto.mobile,
      landline: dto.landline,
      typeId: dto.typeId,
      subTypeId: dto.subTypeId,
      fee: dto.fee ?? 0,
      // Discount comes from the token, not the form — clients can't
      // tamper with the offer terms.
      discount: Number(invitation.discountPercent),
      // Spec §6: invitation-link signups defer payment-method collection
      // until the trial ends. If the form genuinely captured one, honor it;
      // otherwise leave NULL so the AWAITING_PAYMENT_METHOD banner prompts
      // the employer to pick their first method post-trial.
      paymentMethodId: dto.paymentMethodId ?? null,
      accountIban: dto.accountIban,
      bicSwift: dto.bicSwift,
      probationPeriod: String(payload.trialDays),
      responsible: dto.responsible,
      accessAccountStatus: 'request',
      accessEmail: emailLower,
      user: {
        email: emailLower,
        password: dto.password,
      },
    } as any);

    const employerId = (result?.data as any)?.id;
    if (!employerId) {
      throw new BadRequestException('Failed to create employer');
    }

    // EmployersService.create returns the saved Employer but not the user
    // id, so look up the default EmployerUser link to get it. The entity
    // has no explicit FK column, so we go through the relation.
    const link = await this.employerUserRepo.findOne({
      where: { employer: { id: employerId }, isDefault: true },
      relations: ['user'],
    });
    const userId = link?.user?.id;
    if (!userId) {
      throw new BadRequestException(
        'Failed to resolve user for created employer',
      );
    }

    await this.redemptionRepo.save({
      invitationId: invitation.id,
      redeemedEmployerId: employerId,
      redeemedUserId: userId,
      redeemedEmail: emailLower,
    });

    // Touch first-redemption metadata for backwards-compat with old code
    // that still reads acceptedAt / acceptedEmployerId. Status stays
    // PENDING because the link is still usable.
    if (!invitation.acceptedAt) {
      invitation.acceptedAt = new Date();
      invitation.acceptedEmployerId = employerId ?? null;
      await this.invitationRepo.save(invitation);
    }

    return { employerId, userId };
  }

  async revoke(requester: any, publicId: string): Promise<void> {
    const role = String(requester?.role?.name || '').toLowerCase();
    const invitation = await this.invitationRepo.findOne({ where: { publicId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (role !== 'admin' && invitation.issuedByUserId !== requester.id) {
      throw new ForbiddenException('Cannot revoke an invitation you did not issue');
    }
    if (invitation.status === 'REVOKED' || invitation.status === 'EXPIRED') {
      throw new BadRequestException(
        `Invitation is already ${invitation.status.toLowerCase()}`,
      );
    }
    invitation.status = 'REVOKED' as InvitationStatus;
    await this.invitationRepo.save(invitation);
  }

  // ============================================================
  // Token helpers
  // ============================================================

  private signToken(payload: TokenPayload, expiresAt: Date | null): string {
    if (!expiresAt) {
      // No caducidad → 10-year token. Revoke is the kill-switch.
      return this.jwtService.sign(payload, { expiresIn: '3650d' });
    }
    const expiresInSec = Math.max(
      60,
      Math.floor((expiresAt.getTime() - Date.now()) / 1000),
    );
    return this.jwtService.sign(payload, { expiresIn: expiresInSec });
  }

  private verifyToken(token: string): TokenPayload | null {
    try {
      const payload = this.jwtService.verify(token) as TokenPayload;
      if (payload?.type !== TOKEN_TYPE) return null;
      return payload;
    } catch {
      return null;
    }
  }

  private buildLink(token: string): string {
    const base = this.configService.get<string>('FRONTEND_URL') || '';
    return `${base.replace(/\/$/, '')}/accept-invite?token=${token}`;
  }

  // ============================================================
  // Daily cron — expire stale PENDING rows so the history list is honest
  // ============================================================
  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'expire-employer-invitations' })
  async expireStale() {
    const result = await this.invitationRepo
      .createQueryBuilder()
      .update()
      .set({ status: 'EXPIRED' as InvitationStatus })
      .where('status = :status AND expires_at IS NOT NULL AND expires_at <= :now', {
        status: 'PENDING',
        now: new Date(),
      })
      .execute();
    if (result.affected) {
      this.logger.log(`Expired ${result.affected} stale invitations`);
    }
  }
}
