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
  WorkerInvitation,
  WorkerInvitationStatus,
} from '../entities/worker-invitation.entity';
import { WorkerInvitationRedemption } from '../entities/worker-invitation-redemption.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { EmployerWorker } from '../../employers/entities/employer-worker.entity';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { WorkerUser } from '../../workers/entities/worker-user.entity';
import { CreateWorkerInvitationDto } from '../dto/create-worker-invitation.dto';
import { UpdateWorkerInvitationDto } from '../dto/update-worker-invitation.dto';
import { AcceptWorkerInvitationDto } from '../dto/accept-worker-invitation.dto';

const TOKEN_TYPE = 'worker-invite';

interface TokenPayload {
  type: typeof TOKEN_TYPE;
  invitationId: number;
  employerId: number;
  description: string;
  issuedByUserId: number;
}

export interface WorkerInvitationWithMeta extends WorkerInvitation {
  inviteLink?: string;
  acceptedCount?: number;
}

@Injectable()
export class WorkerInvitationService {
  private readonly logger = new Logger(WorkerInvitationService.name);

  constructor(
    @InjectRepository(WorkerInvitation)
    private readonly invitationRepo: Repository<WorkerInvitation>,
    @InjectRepository(WorkerInvitationRedemption)
    private readonly redemptionRepo: Repository<WorkerInvitationRedemption>,
    @InjectRepository(Employer)
    private readonly employerRepo: Repository<Employer>,
    @InjectRepository(EmployerUser)
    private readonly employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ============================================================
  // Public API methods called by the controller
  // ============================================================

  async create(
    requester: any,
    dto: CreateWorkerInvitationDto,
  ): Promise<{ invitation: WorkerInvitation; inviteLink: string }> {
    const role = String(requester?.role?.name || '').toLowerCase();
    if (role !== 'employer') {
      throw new ForbiddenException('Only employers can issue worker invitations');
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
      occupation: dto.occupation,
      employerId,
      maxRedemptions: dto.maxRedemptions ?? null,
      issuedByUserId: requester.id,
      status: 'PENDING' as WorkerInvitationStatus,
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

  async list(requester: any): Promise<WorkerInvitationWithMeta[]> {
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
        'Only admin or employer can view worker invitations',
      );
    }

    const rows = (await qb.getMany()) as WorkerInvitationWithMeta[];

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
  ): Promise<WorkerInvitationRedemption[]> {
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
      relations: ['redeemedWorker', 'redeemedUser'],
      order: { redeemedAt: 'DESC' },
    });
  }

  async verify(token: string): Promise<{
    valid: boolean;
    reason?: string;
    description?: string;
    occupation?: string;
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
      invitation.status = 'EXPIRED' as WorkerInvitationStatus;
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
      occupation: invitation.occupation,
      employerId: invitation.employerId,
      employerName: employer.name,
    };
  }

  async accept(
    dto: AcceptWorkerInvitationDto,
  ): Promise<{ workerId: number; userId: number }> {
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
      invitation.status = 'EXPIRED' as WorkerInvitationStatus;
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

    return this.dataSource.transaction(async (manager) => {
      const workerRole = await manager.findOne(Role, { where: { value: 5 } });
      if (!workerRole) {
        throw new BadRequestException('Worker role not configured');
      }
      const hashed = await bcrypt.hash(dto.password, 10);
      const userEntity = manager.create(User, {
        name: dto.name,
        email: emailLower,
        password: hashed,
        roleId: workerRole.id,
      });
      const savedUser = await manager.save(User, userEntity);

      let genderEntity: any = null;
      if (dto.gender) {
        genderEntity = await manager.findOne('Gender', {
          where: { id: Number(dto.gender) },
        });
      }
      const worker = manager.create(Worker, {
        code: dto.code ?? '',
        landline: dto.landline,
        mobile: dto.mobile,
        nif: dto.nif,
        naf: dto.naf,
        occupation: invitation.occupation || dto.occupation,
        birthday: dto.birthday as any,
        gender: genderEntity,
        accessAccountStatus: 'request',
        active: true,
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
      });
      const savedWorker = await manager.save(Worker, worker);

      const employerWorker = manager.create(EmployerWorker, {
        employer: { id: invitation.employerId } as any,
        worker: { id: savedWorker.id } as any,
        isActive: true,
      } as any);
      await manager.save(EmployerWorker, employerWorker);

      const workerUser = manager.create(WorkerUser, {
        workerId: savedWorker.id,
        userId: savedUser.id,
      });
      await manager.save(WorkerUser, workerUser);

      await manager.save(WorkerInvitationRedemption, {
        invitationId: invitation.id,
        redeemedWorkerId: savedWorker.id,
        redeemedUserId: savedUser.id,
        redeemedEmail: emailLower,
      });

      return { workerId: savedWorker.id, userId: savedUser.id };
    });
  }

  private async assertCanManage(
    requester: any,
    invitation: WorkerInvitation,
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
    dto: UpdateWorkerInvitationDto,
  ): Promise<WorkerInvitation> {
    const invitation = await this.invitationRepo.findOne({ where: { publicId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    await this.assertCanManage(requester, invitation);
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(
        `Cannot edit a ${invitation.status.toLowerCase()} invitation`,
      );
    }

    if (dto.description !== undefined) invitation.description = dto.description;
    if (dto.occupation !== undefined) invitation.occupation = dto.occupation;
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
    invitation.status = 'REVOKED' as WorkerInvitationStatus;
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

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'expire-worker-invitations' })
  async expireStale() {
    const result = await this.invitationRepo
      .createQueryBuilder()
      .update()
      .set({ status: 'EXPIRED' as WorkerInvitationStatus })
      .where('status = :status AND expires_at IS NOT NULL AND expires_at <= :now', {
        status: 'PENDING',
        now: new Date(),
      })
      .execute();
    if (result.affected) {
      this.logger.log(`Expired ${result.affected} stale worker invitations`);
    }
  }
}
