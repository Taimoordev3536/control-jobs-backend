import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { User } from '../users/entities/user.entity';
import { Role } from '../users/entities/role.entity';
import { PartnerUser } from '../partners/entities/partner-user.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { UserRole } from '../auth/enums/user-role.enum';
import { SubUserPermission } from '../auth/enums/sub-user-permission.enum';
import { CreateSubUserDto } from './dto/create-sub-user.dto';
import { UpdateSubUserDto } from './dto/update-sub-user.dto';

type ScopeType = 'partner' | 'employer' | 'client';

interface RequesterScope {
  scope: ScopeType;
  entityId: number;
  roleId: number;
}

export interface SubUserRow {
  id: number;
  junctionId: number;
  scope: ScopeType;
  firstName: string | null;
  lastName: string | null;
  name: string;
  email: string;
  permission: SubUserPermission | null;
  isActive: boolean;
  status: 'active' | 'pending' | 'inactive';
  createdAt: Date;
  inviteLink: string | null;
}

@Injectable()
export class SubUsersService {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Role) private rolesRepo: Repository<Role>,
    @InjectRepository(PartnerUser) private partnerUserRepo: Repository<PartnerUser>,
    @InjectRepository(EmployerUser) private employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(ClientUser) private clientUserRepo: Repository<ClientUser>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resolve which scope (partner/employer/client) the requester owns.
   * Only main users (isDefault=true) can manage sub-users.
   */
  private async resolveRequesterScope(requester: any): Promise<RequesterScope> {
    if (requester?.subUser?.isSubUser) {
      throw new ForbiddenException('Sub-users cannot manage other sub-users');
    }

    const roleValue = requester?.role?.value;
    const userId = requester?.id;

    if (!userId) {
      throw new UnauthorizedException('Invalid requester');
    }

    if (roleValue === UserRole.Partner) {
      const link = await this.partnerUserRepo.findOne({ where: { userId, isDefault: true } });
      if (!link) throw new ForbiddenException('No partner account linked to this user');
      return { scope: 'partner', entityId: link.partnerId, roleId: requester.roleId };
    }

    if (roleValue === UserRole.Employer) {
      const link = await this.employerUserRepo.findOne({
        where: { user: { id: userId }, isDefault: true },
        relations: ['employer'],
      });
      if (!link?.employer) throw new ForbiddenException('No employer account linked to this user');
      return { scope: 'employer', entityId: link.employer.id, roleId: requester.roleId };
    }

    if (roleValue === UserRole.Client) {
      const link = await this.clientUserRepo.findOne({ where: { userId, isDefault: true } });
      if (!link) throw new ForbiddenException('No client account linked to this user');
      return { scope: 'client', entityId: link.clientId, roleId: requester.roleId };
    }

    throw new ForbiddenException('Your role does not support sub-users');
  }

  private computeStatus(user: User): SubUserRow['status'] {
    if (!user.isActive) return 'inactive';
    if (!user.password) return 'pending';
    return 'active';
  }

  private signInviteToken(userId: number, parentUserId: number): string {
    return this.jwtService.sign(
      { type: 'sub-user-invite', id: userId, parentUserId },
      { expiresIn: '7d' },
    );
  }

  private buildInviteLink(token: string): string {
    const base = this.configService.get<string>('FRONTEND_URL') || '';
    return `${base.replace(/\/$/, '')}/accept-invite?token=${token}`;
  }

  /**
   * A pending sub-user still needs to accept the invite. We generate a
   * fresh short-lived link on each list call so the parent can copy/share
   * it. Tokens are stateless (JWT) — no DB storage needed.
   */
  private inviteLinkForPending(user: User, parentUserId: number): string | null {
    if (user.password) return null;
    return this.buildInviteLink(this.signInviteToken(user.id, parentUserId));
  }

  async list(requester: any): Promise<SubUserRow[]> {
    const scope = await this.resolveRequesterScope(requester);
    const rows: SubUserRow[] = [];

    if (scope.scope === 'partner') {
      const links = await this.partnerUserRepo.find({
        where: { parentUserId: requester.id, partnerId: scope.entityId },
        relations: ['user'],
      });
      for (const l of links) rows.push(this.mapRow(l.id, 'partner', l.user, l.permission, requester.id));
    } else if (scope.scope === 'employer') {
      const links = await this.employerUserRepo.find({
        where: { parentUserId: requester.id, employer: { id: scope.entityId } },
        relations: ['user', 'employer'],
      });
      for (const l of links) rows.push(this.mapRow(l.id, 'employer', l.user, l.permission, requester.id));
    } else {
      const links = await this.clientUserRepo.find({
        where: { parentUserId: requester.id, clientId: scope.entityId },
        relations: ['user'],
      });
      for (const l of links) rows.push(this.mapRow(l.id, 'client', l.user, l.permission, requester.id));
    }

    return rows.sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  private mapRow(
    junctionId: number,
    scope: ScopeType,
    user: User,
    permission: SubUserPermission | null,
    parentUserId: number,
  ): SubUserRow {
    return {
      id: user.id,
      junctionId,
      scope,
      firstName: user.firstName,
      lastName: user.lastName,
      name: user.name,
      email: user.email,
      permission,
      isActive: user.isActive,
      status: this.computeStatus(user),
      createdAt: (user as any).createdAt ?? new Date(),
      inviteLink: this.inviteLinkForPending(user, parentUserId),
    };
  }

  async create(
    requester: any,
    dto: CreateSubUserDto,
  ): Promise<{ user: Partial<User>; inviteToken: string; inviteLink: string }> {
    const scope = await this.resolveRequesterScope(requester);

    const existing = await this.usersRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    const role = await this.rolesRepo.findOne({ where: { id: scope.roleId } });
    if (!role) throw new NotFoundException('Parent role not found');

    const user = this.usersRepo.create({
      name: dto.name || `${dto.firstName} ${dto.lastName}`.trim(),
      email: dto.email,
      firstName: dto.firstName,
      lastName: dto.lastName,
      password: '',
      roleId: role.id,
      isActive: false,
    } as Partial<User>);
    const savedUser = await this.usersRepo.save(user);

    if (scope.scope === 'partner') {
      const link = this.partnerUserRepo.create({
        partnerId: scope.entityId,
        userId: savedUser.id,
        isDefault: false,
        permission: dto.permission,
        parentUserId: requester.id,
      });
      await this.partnerUserRepo.save(link);
    } else if (scope.scope === 'employer') {
      const link = this.employerUserRepo.create({
        employer: { id: scope.entityId } as any,
        user: { id: savedUser.id } as any,
        isDefault: false,
        permission: dto.permission,
        parentUserId: requester.id,
      });
      await this.employerUserRepo.save(link);
    } else {
      const link = this.clientUserRepo.create({
        clientId: scope.entityId,
        userId: savedUser.id,
        isDefault: false,
        permission: dto.permission,
        parentUserId: requester.id,
      });
      await this.clientUserRepo.save(link);
    }

    const inviteToken = this.signInviteToken(savedUser.id, requester.id);
    const inviteLink = this.buildInviteLink(inviteToken);
    const { password, ...safeUser } = savedUser;
    return { user: safeUser, inviteToken, inviteLink };
  }

  private async loadJunctionForUser(subUserId: number, parentUserId: number) {
    const candidates = await Promise.all([
      this.partnerUserRepo
        .findOne({ where: { userId: subUserId, parentUserId }, relations: ['user'] })
        .then((r) => (r ? { scope: 'partner' as ScopeType, row: r } : null)),
      this.employerUserRepo
        .findOne({ where: { user: { id: subUserId }, parentUserId }, relations: ['user'] })
        .then((r) => (r ? { scope: 'employer' as ScopeType, row: r } : null)),
      this.clientUserRepo
        .findOne({ where: { userId: subUserId, parentUserId }, relations: ['user'] })
        .then((r) => (r ? { scope: 'client' as ScopeType, row: r } : null)),
    ]);
    return candidates.find((c) => c !== null) || null;
  }

  async update(requester: any, subUserId: number, dto: UpdateSubUserDto): Promise<SubUserRow> {
    await this.resolveRequesterScope(requester);
    const found = await this.loadJunctionForUser(subUserId, requester.id);
    if (!found) throw new NotFoundException('Sub-user not found');

    if (dto.permission) {
      if (found.scope === 'partner') {
        await this.partnerUserRepo.update(
          { id: (found.row as PartnerUser).id },
          { permission: dto.permission },
        );
      } else if (found.scope === 'employer') {
        await this.employerUserRepo.update(
          { id: (found.row as EmployerUser).id },
          { permission: dto.permission },
        );
      } else {
        await this.clientUserRepo.update(
          { id: (found.row as ClientUser).id },
          { permission: dto.permission },
        );
      }
    }

    if (typeof dto.isActive === 'boolean') {
      await this.usersRepo.update({ id: subUserId }, { isActive: dto.isActive } as any);
    }

    const refreshed = await this.loadJunctionForUser(subUserId, requester.id);
    const row = refreshed!.row as any;
    return this.mapRow(row.id, refreshed!.scope, row.user, row.permission, requester.id);
  }

  async remove(requester: any, subUserId: number): Promise<{ isSuccess: boolean }> {
    await this.resolveRequesterScope(requester);
    const found = await this.loadJunctionForUser(subUserId, requester.id);
    if (!found) throw new NotFoundException('Sub-user not found');
    await this.usersRepo.update({ id: subUserId }, { isActive: false } as any);
    return { isSuccess: true };
  }

  /**
   * Generate a fresh invite link. If the user already accepted, we clear
   * their password so the link actually lets them re-set one.
   */
  async resetPassword(
    requester: any,
    subUserId: number,
  ): Promise<{ inviteToken: string; inviteLink: string }> {
    await this.resolveRequesterScope(requester);
    const found = await this.loadJunctionForUser(subUserId, requester.id);
    if (!found) throw new NotFoundException('Sub-user not found');
    await this.usersRepo.update({ id: subUserId }, { password: '', isActive: false } as any);
    const token = this.signInviteToken(subUserId, requester.id);
    return { inviteToken: token, inviteLink: this.buildInviteLink(token) };
  }

  async resendInvite(
    requester: any,
    subUserId: number,
  ): Promise<{ inviteToken: string; inviteLink: string }> {
    return this.resetPassword(requester, subUserId);
  }

  async acceptInvite(token: string, password: string): Promise<{ isSuccess: boolean }> {
    let payload: any;
    try {
      payload = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invite link is invalid or has expired');
    }
    if (payload.type !== 'sub-user-invite' || !payload.id) {
      throw new UnauthorizedException('Invalid invite token');
    }
    const user = await this.usersRepo.findOne({ where: { id: payload.id } });
    if (!user) throw new NotFoundException('User not found');

    const hashed = await bcrypt.hash(password, 10);
    await this.usersRepo.update({ id: user.id }, {
      password: hashed,
      isActive: true,
    } as any);
    return { isSuccess: true };
  }
}
