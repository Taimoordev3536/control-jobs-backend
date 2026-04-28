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
import { LessThanOrEqual, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmployerInvitation, InvitationStatus } from '../entities/employer-invitation.entity';
import { Partner } from '../../partners/entities/partner.entity';
import { PartnerUser } from '../../partners/entities/partner-user.entity';
import { User } from '../../users/entities/user.entity';
import { EmployersService } from '../../employers/employers.service';
import { EmailService } from '../../../common/services/email.service';
import { CreateInvitationDto } from '../dto/create-invitation.dto';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';

const TOKEN_TYPE = 'employer-invite';
const TOKEN_TTL = '7d';

interface TokenPayload {
  type: typeof TOKEN_TYPE;
  invitationId: number;
  email: string;
  partnerId: number;
  trialDays: number;
  issuedByUserId: number;
}

@Injectable()
export class EmployerInvitationService {
  private readonly logger = new Logger(EmployerInvitationService.name);

  constructor(
    @InjectRepository(EmployerInvitation)
    private readonly invitationRepo: Repository<EmployerInvitation>,
    @InjectRepository(Partner)
    private readonly partnerRepo: Repository<Partner>,
    @InjectRepository(PartnerUser)
    private readonly partnerUserRepo: Repository<PartnerUser>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly employersService: EmployersService,
  ) {}

  // ============================================================
  // Public API methods called by the controller
  // ============================================================

  /**
   * Issue a new invitation. Resolves partnerId from request user when the
   * caller is a partner role; admin must supply partnerId explicitly.
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

    // Prevent duplicate active invites for same email — supersede the previous.
    await this.invitationRepo.update(
      { email: dto.email, status: 'PENDING' as InvitationStatus },
      { status: 'REVOKED' as InvitationStatus },
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitation = this.invitationRepo.create({
      email: dto.email,
      partnerId,
      trialDays: dto.trialDays,
      issuedByUserId: requester.id,
      status: 'PENDING' as InvitationStatus,
      expiresAt,
    });
    const saved = await this.invitationRepo.save(invitation);

    const token = this.signToken({
      type: TOKEN_TYPE,
      invitationId: saved.id,
      email: dto.email,
      partnerId,
      trialDays: dto.trialDays,
      issuedByUserId: requester.id,
    });
    const inviteLink = this.buildLink(token);

    try {
      await this.emailService.sendEmployerInvitation(
        dto.email,
        partner.name,
        inviteLink,
        dto.trialDays,
      );
    } catch (err: any) {
      this.logger.warn(`Email send failed (invitation ${saved.id}): ${err?.message || err}`);
      // Email failures don't roll back the invitation — admin can copy the link manually.
    }

    return { invitation: saved, inviteLink };
  }

  /**
   * List invitations sent by the current user (or all, for admin).
   * For PENDING rows, attaches a freshly-signed token + invite link so the
   * caller can copy/resend without us persisting the original JWT anywhere.
   */
  async list(requester: any): Promise<Array<EmployerInvitation & { inviteLink?: string }>> {
    const role = String(requester?.role?.name || '').toLowerCase();
    let rows: EmployerInvitation[];
    if (role === 'admin') {
      rows = await this.invitationRepo.find({
        order: { createdAt: 'DESC' },
        relations: ['partner'],
      });
    } else if (role === 'partner') {
      const link = await this.partnerUserRepo.findOne({
        where: { userId: requester.id },
      });
      if (!link?.partnerId) return [];
      rows = await this.invitationRepo.find({
        where: { partnerId: link.partnerId },
        order: { createdAt: 'DESC' },
        relations: ['partner'],
      });
    } else {
      throw new ForbiddenException('Only admin or partner can view invitations');
    }

    return rows.map((inv) => {
      if (inv.status !== 'PENDING' || inv.expiresAt.getTime() < Date.now()) {
        return inv;
      }
      // Re-mint a token with the same expiry as the row so links remain stable.
      // Tokens are stateless — anyone with this row can sign one with the same payload.
      const expiresInSec = Math.max(
        60,
        Math.floor((inv.expiresAt.getTime() - Date.now()) / 1000),
      );
      const token = this.jwtService.sign(
        {
          type: TOKEN_TYPE,
          invitationId: inv.id,
          email: inv.email,
          partnerId: inv.partnerId,
          trialDays: inv.trialDays,
          issuedByUserId: inv.issuedByUserId,
        },
        { expiresIn: expiresInSec },
      );
      return Object.assign({}, inv, { inviteLink: this.buildLink(token) });
    });
  }

  /**
   * Verify a token without consuming it. Used by the accept page to
   * pre-fill the form with the partner name, email, trial days.
   */
  async verify(token: string): Promise<{
    valid: boolean;
    reason?: string;
    email?: string;
    partnerId?: number;
    partnerName?: string;
    trialDays?: number;
  }> {
    const payload = this.verifyToken(token);
    if (!payload) return { valid: false, reason: 'invalid' };

    const invitation = await this.invitationRepo.findOne({
      where: { id: payload.invitationId },
    });
    if (!invitation) return { valid: false, reason: 'not_found' };
    if (invitation.status === 'ACCEPTED') return { valid: false, reason: 'already_used' };
    if (invitation.status === 'REVOKED') return { valid: false, reason: 'revoked' };
    if (invitation.expiresAt.getTime() < Date.now()) {
      // Lazy-expire on read.
      invitation.status = 'EXPIRED' as InvitationStatus;
      await this.invitationRepo.save(invitation);
      return { valid: false, reason: 'expired' };
    }

    const partner = await this.partnerRepo.findOne({ where: { id: payload.partnerId } });
    if (!partner) return { valid: false, reason: 'partner_missing' };

    return {
      valid: true,
      email: invitation.email,
      partnerId: invitation.partnerId,
      partnerName: partner.name,
      trialDays: invitation.trialDays,
    };
  }

  /**
   * Accept the invitation: create User, Employer, EmployerUser link in
   * one transaction, mark the invitation ACCEPTED.
   */
  async accept(dto: AcceptInvitationDto): Promise<{ employerId: number; userId: number }> {
    const payload = this.verifyToken(dto.token);
    if (!payload) throw new UnauthorizedException('Invalid invitation token');

    const invitation = await this.invitationRepo.findOne({
      where: { id: payload.invitationId },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`Invitation is ${invitation.status.toLowerCase()}`);
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      invitation.status = 'EXPIRED' as InvitationStatus;
      await this.invitationRepo.save(invitation);
      throw new BadRequestException('Invitation expired');
    }
    // Strict email match — token is bound to the address it was issued to.
    if (invitation.email.toLowerCase() !== dto.email.toLowerCase()) {
      throw new BadRequestException('Email does not match invitation');
    }
    // Defence in depth: cross-check partner & trial against the token.
    if (invitation.partnerId !== payload.partnerId) {
      throw new BadRequestException('Partner mismatch');
    }
    if (invitation.trialDays !== payload.trialDays) {
      throw new BadRequestException('Trial mismatch');
    }
    // Reject if a user already exists with that email.
    const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingUser) {
      throw new BadRequestException('An account already exists with this email');
    }

    // Reuse the existing EmployersService.create — it handles rate snapshot,
    // trial start, EmployerUser link, password hashing, etc.
    const result = await this.employersService.create({
      // employer fields
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
      discount: dto.discount,
      paymentMethodId: dto.paymentMethodId ?? 5,
      accountIban: dto.accountIban,
      bicSwift: dto.bicSwift,
      probationPeriod: String(payload.trialDays),
      responsible: dto.responsible,
      accessAccountStatus: 'request',
      accessEmail: dto.email,
      // user fields — forwarded inside the same call
      user: {
        email: dto.email,
        password: dto.password,
      },
    } as any);

    const employerId = (result?.data as any)?.id;
    const userId = (result?.data as any)?.userId || (result?.data as any)?.user?.id;

    invitation.status = 'ACCEPTED' as InvitationStatus;
    invitation.acceptedAt = new Date();
    invitation.acceptedEmployerId = employerId ?? null;
    await this.invitationRepo.save(invitation);

    return { employerId, userId };
  }

  async revoke(requester: any, publicId: string): Promise<void> {
    const role = String(requester?.role?.name || '').toLowerCase();
    const invitation = await this.invitationRepo.findOne({ where: { publicId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    if (role !== 'admin' && invitation.issuedByUserId !== requester.id) {
      throw new ForbiddenException('Cannot revoke an invitation you did not issue');
    }
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`Invitation is already ${invitation.status.toLowerCase()}`);
    }
    invitation.status = 'REVOKED' as InvitationStatus;
    await this.invitationRepo.save(invitation);
  }

  // ============================================================
  // Token helpers
  // ============================================================

  private signToken(payload: TokenPayload): string {
    return this.jwtService.sign(payload, { expiresIn: TOKEN_TTL });
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
      .where('status = :status AND expires_at <= :now', {
        status: 'PENDING',
        now: new Date(),
      })
      .execute();
    if (result.affected) {
      this.logger.log(`Expired ${result.affected} stale invitations`);
    }
  }
}
