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
import { DataSource, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as bcrypt from 'bcryptjs';

import {
  ClientInvitation,
  ClientInvitationStatus,
} from '../entities/client-invitation.entity';
import { ClientInvitationRedemption } from '../entities/client-invitation-redemption.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { EmployerClient } from '../../employers/entities/employer-client.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Client } from '../../clients/entities/client.entity';
import { ClientUser } from '../../clients/entities/client-user.entity';
import { CreateClientInvitationDto } from '../dto/create-client-invitation.dto';
import { UpdateClientInvitationDto } from '../dto/update-client-invitation.dto';
import { AcceptClientInvitationDto } from '../dto/accept-client-invitation.dto';
import { EmailVerificationService } from '../../../common/services/email-verification.service';

const TOKEN_TYPE = 'client-invite';

interface TokenPayload {
  type: typeof TOKEN_TYPE;
  invitationId: number;
  employerId: number;
  description: string;
  issuedByUserId: number;
}

export interface ClientInvitationWithMeta extends ClientInvitation {
  inviteLink?: string;
  acceptedCount?: number;
}

@Injectable()
export class ClientInvitationService {
  private readonly logger = new Logger(ClientInvitationService.name);

  constructor(
    @InjectRepository(ClientInvitation)
    private readonly invitationRepo: Repository<ClientInvitation>,
    @InjectRepository(ClientInvitationRedemption)
    private readonly redemptionRepo: Repository<ClientInvitationRedemption>,
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    @InjectRepository(EmployerUser)
    private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailVerificationService: EmailVerificationService,
  ) {}

  async create(
    requester: any,
    dto: CreateClientInvitationDto,
  ): Promise<{ invitation: ClientInvitation; inviteLink: string }> {
    const role = String(requester?.role?.name || '').toLowerCase();
    if (role !== 'employer') {
      throw new ForbiddenException('Only employers can issue client invitations');
    }

    const link = await this.employerUserRepo.findOne({
      where: { user: { id: requester.id } },
      relations: ['employer'],
    });
    if (!link?.employer?.id) {
      throw new ForbiddenException('Employer account not linked');
    }
    const employerId = link.employer.id;

    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'La fecha de caducidad debe ser posterior a la fecha actual',
      );
    }

    const invitation = this.invitationRepo.create({
      description: dto.description,
      type: dto.type,
      employerId,
      maxRedemptions: dto.maxRedemptions ?? null,
      issuedByUserId: requester.id,
      status: 'PENDING' as ClientInvitationStatus,
      expiresAt,
    });
    const saved = await this.invitationRepo.save(invitation);

    const token = this.signToken(
      {
        type: TOKEN_TYPE,
        invitationId: saved.id,
        employerId,
        description: dto.description,
        issuedByUserId: requester.id,
      },
      expiresAt,
    );
    const inviteLink = this.buildLink(token);

    return { invitation: saved, inviteLink };
  }

  async list(requester: any): Promise<ClientInvitationWithMeta[]> {
    const role = String(requester?.role?.name || '').toLowerCase();

    const qb = this.invitationRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.employer', 'employer')
      .loadRelationCountAndMap('inv.acceptedCount', 'inv.redemptions')
      .orderBy('inv.createdAt', 'DESC');

    if (role === 'admin') {
      // admin sees all
    } else if (role === 'employer') {
      const link = await this.employerUserRepo.findOne({
        where: { user: { id: requester.id } },
        relations: ['employer'],
      });
      if (!link?.employer?.id) return [];
      qb.where('inv.employerId = :eid', { eid: link.employer.id });
    } else {
      throw new ForbiddenException(
        'Only admin or employer can view client invitations',
      );
    }

    const rows = (await qb.getMany()) as ClientInvitationWithMeta[];

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
          employerId: inv.employerId,
          description: inv.description,
          issuedByUserId: inv.issuedByUserId,
        },
        expiresInSec ? { expiresIn: expiresInSec } : {},
      );
      return Object.assign(inv, { inviteLink: this.buildLink(token) });
    });
  }

  async listRedemptions(
    requester: any,
    publicId: string,
  ): Promise<ClientInvitationRedemption[]> {
    const role = String(requester?.role?.name || '').toLowerCase();
    const inv = await this.invitationRepo.findOne({ where: { publicId } });
    if (!inv) throw new NotFoundException('Invitation not found');

    if (role === 'employer') {
      const link = await this.employerUserRepo.findOne({
        where: { user: { id: requester.id } },
        relations: ['employer'],
      });
      if (!link?.employer?.id || link.employer.id !== inv.employerId) {
        throw new ForbiddenException('Not your invitation');
      }
    } else if (role !== 'admin') {
      throw new ForbiddenException(
        'Only admin or employer can view redemptions',
      );
    }

    return this.redemptionRepo.find({
      where: { invitationId: inv.id },
      relations: ['redeemedClient'],
      order: { redeemedAt: 'DESC' },
    });
  }

  async verify(token: string): Promise<{
    valid: boolean;
    reason?: string;
    description?: string;
    type?: 'company' | 'particular';
    employerId?: number;
    employerName?: string;
  }> {
    const payload = this.verifyToken(token);
    if (!payload) return { valid: false, reason: 'invalid' };

    const invitation = await this.invitationRepo.findOne({
      where: { id: payload.invitationId },
    });
    if (!invitation) return { valid: false, reason: 'not_found' };
    if (invitation.status === 'REVOKED') return { valid: false, reason: 'revoked' };
    if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
      invitation.status = 'EXPIRED' as ClientInvitationStatus;
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

    const employer = await this.employerRepo.findOne({
      where: { id: payload.employerId },
    });
    if (!employer) return { valid: false, reason: 'employer_missing' };

    return {
      valid: true,
      description: invitation.description,
      type: invitation.type,
      employerId: invitation.employerId,
      employerName: employer.name,
    };
  }

  async accept(
    dto: AcceptClientInvitationDto,
  ): Promise<{ clientId: number; userId: number }> {
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
      invitation.status = 'EXPIRED' as ClientInvitationStatus;
      await this.invitationRepo.save(invitation);
      throw new BadRequestException('Invitation expired');
    }
    if (invitation.employerId !== payload.employerId) {
      throw new BadRequestException('Employer mismatch');
    }

    if (invitation.maxRedemptions !== null) {
      const used = await this.redemptionRepo.count({
        where: { invitationId: invitation.id },
      });
      if (used >= invitation.maxRedemptions) {
        throw new BadRequestException(
          'Invitation has reached its redemption limit',
        );
      }
    }

    const emailLower = dto.email.trim().toLowerCase();

    const dup = await this.redemptionRepo.findOne({
      where: { invitationId: invitation.id, redeemedEmail: emailLower },
    });
    if (dup) {
      throw new BadRequestException(
        'Este email ya ha canjeado la invitación. Pruebe a iniciar sesión.',
      );
    }

    const existingUser = await this.userRepo.findOne({
      where: { email: emailLower },
    });
    if (existingUser) {
      throw new BadRequestException(
        'An account already exists with this email. Please log in.',
      );
    }

    const txResult = await this.dataSource.transaction(async (manager) => {
      const clientRole = await manager.findOne(Role, { where: { value: 4 } });
      if (!clientRole) {
        throw new BadRequestException('Client role not configured');
      }
      const hashed = await bcrypt.hash(dto.password, 10);
      const userEntity = manager.create(User, {
        name: dto.name,
        email: emailLower,
        password: hashed,
        roleId: clientRole.id,
      });
      const savedUser = await manager.save(User, userEntity);

      const client = manager.create(Client, {
        name: dto.name,
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
        landline: dto.landline,
        mobile: dto.mobile,
        type: invitation.type || dto.type,
        code: dto.code ?? '',
        taxId: dto.taxId,
        status: 'Active',
        observation: dto.observation,
        responsible: dto.responsible,
        accessAccountStatus: 'request',
        active: true,
        userId: savedUser.id,
      });
      const savedClient = await manager.save(Client, client);

      const employerClient = manager.create(EmployerClient, {
        employer: { id: invitation.employerId } as any,
        client: { id: savedClient.id } as any,
        isActive: true,
      });
      await manager.save(EmployerClient, employerClient);

      const clientUser = manager.create(ClientUser, {
        clientId: savedClient.id,
        userId: savedUser.id,
        isDefault: true,
      });
      await manager.save(ClientUser, clientUser);

      await manager.save(ClientInvitationRedemption, {
        invitationId: invitation.id,
        redeemedClientId: savedClient.id,
        redeemedUserId: savedUser.id,
        redeemedEmail: emailLower,
      });

      return { clientId: savedClient.id, userId: savedUser.id };
    });

    await this.emailVerificationService.issueToken(txResult.userId, dto.name);
    return txResult;
  }

  private async assertCanManage(
    requester: any,
    invitation: ClientInvitation,
  ): Promise<void> {
    const role = String(requester?.role?.name || '').toLowerCase();
    if (role === 'admin') return;
    const link = await this.employerUserRepo.findOne({
      where: { user: { id: requester.id } },
      relations: ['employer'],
    });
    if (link?.employer?.id !== invitation.employerId) {
      throw new ForbiddenException('Not your invitation');
    }
  }

  async update(
    requester: any,
    publicId: string,
    dto: UpdateClientInvitationDto,
  ): Promise<ClientInvitation> {
    const invitation = await this.invitationRepo.findOne({ where: { publicId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    await this.assertCanManage(requester, invitation);
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot edit a ${invitation.status.toLowerCase()} invitation`,
      );
    }

    if (dto.description !== undefined) invitation.description = dto.description;
    if (dto.type !== undefined) invitation.type = dto.type;
    if (dto.expiresAt !== undefined) {
      const newExp = dto.expiresAt ? new Date(dto.expiresAt) : null;
      if (newExp && newExp.getTime() <= Date.now()) {
        throw new BadRequestException(
          'La fecha de caducidad debe ser posterior a la fecha actual',
        );
      }
      invitation.expiresAt = newExp;
    }
    return this.invitationRepo.save(invitation);
  }

  async remove(requester: any, publicId: string): Promise<void> {
    const invitation = await this.invitationRepo.findOne({ where: { publicId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    await this.assertCanManage(requester, invitation);
    const used = await this.redemptionRepo.count({
      where: { invitationId: invitation.id },
    });
    if (used > 0) {
      throw new BadRequestException(
        'Cannot delete an invitation that has been redeemed; revoke it instead',
      );
    }
    await this.invitationRepo.remove(invitation);
  }

  async revoke(requester: any, publicId: string): Promise<void> {
    const invitation = await this.invitationRepo.findOne({ where: { publicId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    await this.assertCanManage(requester, invitation);
    if (invitation.status === 'REVOKED' || invitation.status === 'EXPIRED') {
      throw new BadRequestException(
        `Invitation is already ${invitation.status.toLowerCase()}`,
      );
    }
    invitation.status = 'REVOKED' as ClientInvitationStatus;
    await this.invitationRepo.save(invitation);
  }

  // ============================================================
  // Token helpers
  // ============================================================

  private signToken(payload: TokenPayload, expiresAt: Date | null): string {
    if (!expiresAt) {
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

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'expire-client-invitations' })
  async expireStale() {
    const result = await this.invitationRepo
      .createQueryBuilder()
      .update()
      .set({ status: 'EXPIRED' as ClientInvitationStatus })
      .where('status = :status AND expires_at IS NOT NULL AND expires_at <= :now', {
        status: 'PENDING',
        now: new Date(),
      })
      .execute();
    if (result.affected) {
      this.logger.log(`Expired ${result.affected} stale client invitations`);
    }
  }
}
