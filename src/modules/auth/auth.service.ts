import {
  Injectable,
  UnauthorizedException,
  Inject,
  forwardRef,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { Partner } from '../partners/entities/partner.entity';
import { Employer } from '../employers/entities/employer.entity';
import { EmployerUser } from '../employers/entities/employer-user.entity';
import { EmployerClient } from '../employers/entities/employer-client.entity';
import { EmployerWorker } from '../employers/entities/employer-worker.entity';
import { Client } from '../clients/entities/client.entity';
import { ClientUser } from '../clients/entities/client-user.entity';
import { Worker } from '../workers/entities/worker.entity';
import { WorkerUser } from '../workers/entities/worker-user.entity';
import { ImpersonationLog } from './entities/impersonation-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../users/entities/role.entity';
import * as bcrypt from 'bcrypt';
import { UserRole } from './enums/user-role.enum';
import { LoginDto } from './dto/login.dto';
import { ImpersonateDto } from './dto/impersonate.dto';
import { BaseResponse } from '../../common/interfaces/base-response.interface';
import { EmailCheckerService } from '../../common/services/email-checker.service';
import { PartnerUser } from '../partners/entities/partner-user.entity';
import { RefreshTokenService } from './services/refresh-token.service';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    private readonly emailCheckerService: EmailCheckerService,
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,
    @InjectRepository(PartnerUser)
    private partnerUserRepository: Repository<PartnerUser>,
    @InjectRepository(EmployerUser)
    private employerUserRepository: Repository<EmployerUser>,
    @InjectRepository(Employer)
    private employerRepository: Repository<Employer>,
    @InjectRepository(EmployerClient)
    private employerClientRepository: Repository<EmployerClient>,
    @InjectRepository(EmployerWorker)
    private employerWorkerRepository: Repository<EmployerWorker>,
    @InjectRepository(Client)
    private clientRepository: Repository<Client>,
    @InjectRepository(ClientUser)
    private clientUserRepository: Repository<ClientUser>,
    @InjectRepository(Worker)
    private workerRepository: Repository<Worker>,
    @InjectRepository(WorkerUser)
    private workerUserRepository: Repository<WorkerUser>,
    @InjectRepository(ImpersonationLog)
    private impersonationLogRepository: Repository<ImpersonationLog>,
    private readonly refreshTokenService: RefreshTokenService,
  ) { }

  /**
   * Register a new user
   * @param registerDto - Registration data
   * @returns Created user data
   */
  async register(registerDto: RegisterDto): Promise<BaseResponse> {
    try {
      // Check if email is unique
      await this.emailCheckerService.checkEmailUnique(registerDto.email);

      // Hash the password
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      // Get the specified role or default to worker role (value: 5)
      const roleValue = registerDto.role || 5;
      const role = await this.rolesRepository.findOne({
        where: { value: roleValue },
      });

      if (!role) {
        throw new BadRequestException(`Invalid role value: ${roleValue}. Valid roles are: Admin(1), Partner(2), Employer(3), Client(4), Worker(5)`);
      }

      const user = await this.usersService.create({
        ...registerDto,
        name: registerDto.name,
        password: hashedPassword,
        roleId: role.id,
      });

      // Remove sensitive data
      const { password, ...userWithoutPassword } = user;

      return {
        message: 'User registered successfully',
        data: { user: userWithoutPassword },
        isSuccess: true,
        statusCode: 201,
        developerError: '',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Login user
   * @param loginDto - Login credentials
   * @returns User data with token
   */
  async login(
    loginDto: LoginDto,
    deviceInfo?: string | null,
    ipAddress?: string | null,
  ): Promise<BaseResponse> {
    try {
      const user = await this.usersService.findByEmail(loginDto.email);

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const passwordValid = await this.usersService.validatePassword(loginDto.password, user.password);

      if (!passwordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      if (user.roleId !== 1 && !(user as any).emailVerifiedAt) {
        throw new ForbiddenException(`EMAIL_NOT_VERIFIED:${user.email}`);
      }

      // Attach entity id for each role
      let entityId = null;
      let partnerId = null;
      // Additional employer info to return in response/token when available
      let employerInfo: any = null;

      if (user.roleId === 2) { // Partner
        // Find the partner-user link for this user
        const partnerUser = await this.partnerUserRepository.findOne({ where: { userId: user.id } });
        if (partnerUser) {
          entityId = partnerUser.partnerId;
          partnerId = partnerUser.partnerId;
        }
      } else if (user.roleId === 3) { // Employer
        // Try to fetch employer record linked to this user via EmployerUser repository
        try {
          const eu = await this.employerUserRepository.findOne({ where: { user: { id: user.id } }, relations: ['employer'] });
          if (eu?.employer) employerInfo = eu.employer;
        } catch (e) {
          // ignore lookup errors
        }

        // If we have employer info, populate entityId with employer.id
        if (employerInfo && employerInfo.id) {
          entityId = employerInfo.id;
        } else {
          // default to user id if no employer entity found
          entityId = user.id;
        }
      } else if (user.roleId === 1) { // Admin
        entityId = user.id;
      } // Add more roles as needed

      const accessToken = this.generateToken(user, { employerId: employerInfo?.id, employerSubTypeId: employerInfo?.subTypeId });
      const refresh = await this.refreshTokenService.issue(user.id, deviceInfo, ipAddress);

      // Remove sensitive data
      const { password, ...userWithoutPassword } = user;

      // Include employer subtype/type info in returned user when available
      const returnedUser: any = { ...userWithoutPassword, partnerId };
      if (employerInfo) {
        returnedUser.employer = {
          id: employerInfo.id,
          publicId: employerInfo.publicId,
          name: employerInfo.name,
          typeId: employerInfo.typeId,
          subTypeId: employerInfo.subTypeId,
        };
      }

      return {
        message: 'Login successful',
        data: {
          user: returnedUser,
          accessToken,
          refreshToken: refresh.raw,
          accessExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
          // Backwards-compat alias for callers still reading data.token. Remove
          // once the frontend has migrated to data.accessToken.
          token: accessToken,
        },
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  async refresh(
    refreshToken: string,
    deviceInfo?: string | null,
    ipAddress?: string | null,
  ): Promise<BaseResponse> {
    const { userId, next } = await this.refreshTokenService.rotate(
      refreshToken,
      deviceInfo,
      ipAddress,
    );
    const user = await this.usersService.findById(userId, ['role']);
    if (!user) throw new UnauthorizedException('User not found');

    let employerInfo: any = null;
    if (user.roleId === 3) {
      const eu = await this.employerUserRepository.findOne({
        where: { user: { id: user.id } },
        relations: ['employer'],
      });
      if (eu?.employer) employerInfo = eu.employer;
    }

    const accessToken = this.generateToken(user, {
      employerId: employerInfo?.id,
      employerSubTypeId: employerInfo?.subTypeId,
    });

    return {
      message: 'Refreshed',
      data: {
        accessToken,
        refreshToken: next.raw,
        accessExpiresIn: ACCESS_TOKEN_TTL_SECONDS,
      },
      isSuccess: true,
      statusCode: 200,
      developerError: '',
    };
  }

  async logout(refreshToken: string | null): Promise<BaseResponse> {
    if (refreshToken) {
      await this.refreshTokenService.revoke(refreshToken);
    }
    return {
      message: 'Logged out',
      data: null,
      isSuccess: true,
      statusCode: 200,
      developerError: '',
    };
  }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email, ['role']);
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    if (!user.role) {
      return null;
    }

    return user;
  }

  /**
   * Get user profile
   * @param userId - User ID
   * @returns User profile data
   */
  async getProfile(userId: number): Promise<BaseResponse> {
    try {
      const user = await this.usersService.findOne(userId);
      const { password, ...userWithoutPassword } = user;

      let partnerId: number | null = null;
      let employerInfo: any = null;

      if (user.roleId === 2) {
        const partnerUser = await this.partnerUserRepository.findOne({
          where: { userId: user.id },
        });
        if (partnerUser) partnerId = partnerUser.partnerId;
      } else if (user.roleId === 3) {
        try {
          const eu = await this.employerUserRepository.findOne({
            where: { user: { id: user.id } },
            relations: ['employer'],
          });
          if (eu?.employer) employerInfo = eu.employer;
        } catch (e) {
          // ignore lookup errors
        }
      }

      const data: any = { ...userWithoutPassword, partnerId };
      if (employerInfo) {
        data.employer = {
          id: employerInfo.id,
          publicId: employerInfo.publicId,
          name: employerInfo.name,
          typeId: employerInfo.typeId,
          subTypeId: employerInfo.subTypeId,
        };
      }

      return {
        message: 'Profile retrieved successfully',
        data,
        isSuccess: true,
        statusCode: 200,
        developerError: '',
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Impersonate a child user.
   * Accepts an entity type (partner/employer/client/worker) and the entity's publicId.
   * Resolves the default user for that entity, validates hierarchy and ownership,
   * generates a short-lived token, and logs the event for auditing.
   */
  async impersonate(
    requester: any,
    dto: ImpersonateDto,
    ipAddress?: string,
  ): Promise<BaseResponse> {
    const requesterRoleValue = requester.role?.value ?? requester.roleValue;

    // Main users always may; sub-users may impersonate only with EDIT permission.
    // VIEW_ONLY members get the same 403 the UI hides for.
    if (requester.subUser?.isSubUser && requester.subUser?.permission !== 'EDIT') {
      throw new ForbiddenException('Read-only members cannot impersonate other users');
    }

    // Only Admin, Partner, Employer can impersonate
    if (![UserRole.Admin, UserRole.Partner, UserRole.Employer].includes(requesterRoleValue)) {
      throw new ForbiddenException('Your role cannot impersonate other users');
    }

    // Already impersonating? Block chained impersonation.
    if (requester.impersonation?.isImpersonating) {
      throw new ForbiddenException('Cannot impersonate from an impersonated session');
    }

    // Resolve the default user for the target entity
    const resolved = await this.resolveDefaultUserFromEntity(dto.targetEntityType, dto.targetEntityPublicId);
    if (!resolved) {
      throw new BadRequestException('Target entity not found or has no associated user account');
    }

    const { targetUser, entityId, entityType, employer, partnerId } = resolved;

    if ((targetUser as any).isActive === false) {
      throw new BadRequestException('Target user account is deactivated');
    }

    const targetRoleValue = targetUser.role?.value ?? targetUser.roleId;

    // Validate allowed impersonation pairs
    const allowed = this.isImpersonationAllowed(requesterRoleValue, targetRoleValue);
    if (!allowed) {
      throw new ForbiddenException(
        `Role ${requesterRoleValue} cannot impersonate role ${targetRoleValue}`,
      );
    }

    // Validate ownership (skip for Admin)
    if (requesterRoleValue !== UserRole.Admin) {
      await this.validateImpersonationOwnership(requester, targetUser, requesterRoleValue, targetRoleValue);
    }

    // Generate short-lived impersonation token (1 hour)
    const token = this.generateToken(
      targetUser,
      {
        employerId: employer?.id,
        employerSubTypeId: employer?.subTypeId,
        isImpersonating: true,
        impersonatorUserId: requester.id,
        impersonatorRole: this.roleValueToName(requesterRoleValue),
      },
      '1h',
    );

    // Audit log
    await this.impersonationLogRepository.save({
      impersonatorUserId: requester.id,
      impersonatorRole: this.roleValueToName(requesterRoleValue),
      targetUserId: targetUser.id,
      targetRole: this.roleValueToName(targetRoleValue),
      targetEntityId: entityId,
      targetEntityType: entityType,
      ipAddress: ipAddress || null,
    });

    // Build user response (same shape as login response)
    const { password, ...userWithoutPassword } = targetUser;
    const returnedUser: any = { ...userWithoutPassword };
    if (employer) {
      returnedUser.employer = {
        id: employer.id,
        publicId: employer.publicId,
        name: employer.name,
        typeId: employer.typeId,
        subTypeId: employer.subTypeId,
      };
    }
    if (partnerId) {
      returnedUser.partnerId = partnerId;
    }

    return {
      message: 'Impersonation token generated',
      data: { user: returnedUser, token },
      isSuccess: true,
      statusCode: 200,
      developerError: '',
    };
  }

  /**
   * Check if the requester's role is allowed to impersonate the target's role.
   * Allowed pairs:
   *   Admin(1) → Partner(2), Employer(3)
   *   Partner(2) → Employer(3)
   *   Employer(3) → Client(4), Worker(5)
   */
  private isImpersonationAllowed(requesterRole: number, targetRole: number): boolean {
    const allowedMap: Record<number, number[]> = {
      [UserRole.Admin]: [UserRole.Partner, UserRole.Employer],
      [UserRole.Partner]: [UserRole.Employer],
      [UserRole.Employer]: [UserRole.Client, UserRole.Worker],
    };
    return (allowedMap[requesterRole] || []).includes(targetRole);
  }

  /**
   * Validate that the requester owns the target entity.
   */
  private async validateImpersonationOwnership(
    requester: any,
    targetUser: any,
    requesterRole: number,
    targetRole: number,
  ): Promise<void> {
    if (requesterRole === UserRole.Partner && targetRole === UserRole.Employer) {
      // Partner → Employer: employer.partnerId must match requester's partnerId
      const requesterPartnerLink = await this.partnerUserRepository.findOne({
        where: { userId: requester.id, isDefault: true },
      });
      if (!requesterPartnerLink) {
        throw new ForbiddenException('Requester partner record not found');
      }

      const targetEmployerLink = await this.employerUserRepository.findOne({
        where: { user: { id: targetUser.id }, isDefault: true },
        relations: ['employer'],
      });
      if (!targetEmployerLink?.employer) {
        throw new ForbiddenException('Target employer record not found');
      }

      if (targetEmployerLink.employer.partnerId !== requesterPartnerLink.partnerId) {
        throw new ForbiddenException('You can only impersonate employers that belong to your partner account');
      }
    } else if (requesterRole === UserRole.Employer && targetRole === UserRole.Client) {
      // Employer → Client: client must be linked to requester's employer via employerClients
      const requesterEmployerLink = await this.employerUserRepository.findOne({
        where: { user: { id: requester.id }, isDefault: true },
        relations: ['employer'],
      });
      if (!requesterEmployerLink?.employer) {
        throw new ForbiddenException('Requester employer record not found');
      }

      const targetClientLink = await this.clientUserRepository.findOne({
        where: { userId: targetUser.id, isDefault: true },
      });
      if (!targetClientLink) {
        throw new ForbiddenException('Target client record not found');
      }

      const employerClient = await this.employerClientRepository.findOne({
        where: {
          employer: { id: requesterEmployerLink.employer.id },
          client: { id: targetClientLink.clientId },
          isActive: true,
        },
      });
      if (!employerClient) {
        throw new ForbiddenException('You can only impersonate clients that belong to your employer account');
      }
    } else if (requesterRole === UserRole.Employer && targetRole === UserRole.Worker) {
      // Employer → Worker: worker must be linked to requester's employer via employerWorkers
      const requesterEmployerLink = await this.employerUserRepository.findOne({
        where: { user: { id: requester.id }, isDefault: true },
        relations: ['employer'],
      });
      if (!requesterEmployerLink?.employer) {
        throw new ForbiddenException('Requester employer record not found');
      }

      const targetWorkerLink = await this.workerUserRepository.findOne({
        where: { userId: targetUser.id },
      });
      if (!targetWorkerLink) {
        throw new ForbiddenException('Target worker record not found');
      }

      const employerWorker = await this.employerWorkerRepository.findOne({
        where: {
          employer: { id: requesterEmployerLink.employer.id },
          worker: { id: targetWorkerLink.workerId },
          isActive: true,
        },
      });
      if (!employerWorker) {
        throw new ForbiddenException('You can only impersonate workers that belong to your employer account');
      }
    }
  }

  /**
   * Given an entity type and publicId, find the default user associated with that entity.
   * Returns the user (with role loaded) plus entity metadata for token generation.
   */
  private async resolveDefaultUserFromEntity(
    entityType: string,
    entityPublicId: string,
  ): Promise<{
    targetUser: any;
    entityId: number;
    entityType: string;
    employer?: any;
    partnerId?: number;
  } | null> {
    if (entityType === 'partner') {
      const partner = await this.partnerRepository.findOne({ where: { publicId: entityPublicId } });
      if (!partner) return null;
      const link = await this.partnerUserRepository.findOne({
        where: { partnerId: partner.id, isDefault: true },
      });
      if (!link) return null;
      const user = await this.usersService.findById(link.userId, ['role']);
      if (!user) return null;
      return { targetUser: user, entityId: partner.id, entityType: 'partner', partnerId: partner.id };
    }

    if (entityType === 'employer') {
      const employer = await this.employerRepository.findOne({ where: { publicId: entityPublicId } });
      if (!employer) return null;
      const link = await this.employerUserRepository.findOne({
        where: { employer: { id: employer.id }, isDefault: true },
        relations: ['user'],
      });
      if (!link?.user) return null;
      const user = await this.usersService.findById(link.user.id, ['role']);
      if (!user) return null;
      return { targetUser: user, entityId: employer.id, entityType: 'employer', employer };
    }

    if (entityType === 'client') {
      const client = await this.clientRepository.findOne({ where: { publicId: entityPublicId } });
      if (!client) return null;
      const link = await this.clientUserRepository.findOne({
        where: { clientId: client.id, isDefault: true },
      });
      if (!link) return null;
      const user = await this.usersService.findById(link.userId, ['role']);
      if (!user) return null;
      return { targetUser: user, entityId: client.id, entityType: 'client' };
    }

    if (entityType === 'worker') {
      const worker = await this.workerRepository.findOne({ where: { publicId: entityPublicId } });
      if (!worker) return null;
      const link = await this.workerUserRepository.findOne({
        where: { workerId: worker.id },
      });
      if (!link) return null;
      const user = await this.usersService.findById(link.userId, ['role']);
      if (!user) return null;
      return { targetUser: user, entityId: worker.id, entityType: 'worker' };
    }

    return null;
  }

  async resolveImpersonatorLogo(
    impersonatorUserId: number,
    impersonatorRole: string | null | undefined,
  ): Promise<string | null> {
    if (impersonatorRole === 'Employer') {
      const link = await this.employerUserRepository.findOne({
        where: { user: { id: impersonatorUserId }, isDefault: true },
        relations: ['employer'],
      });
      return link?.employer?.logoUrl ?? null;
    }
    return null;
  }

  private roleValueToName(roleValue: number): string {
    const names: Record<number, string> = {
      [UserRole.Admin]: 'Admin',
      [UserRole.Partner]: 'Partner',
      [UserRole.Employer]: 'Employer',
      [UserRole.Client]: 'Client',
      [UserRole.Worker]: 'Worker',
    };
    return names[roleValue] || 'Unknown';
  }

  /**
   * Generate JWT token
   * @param user - User data
   * @returns JWT token
   */
  private generateToken(
    user: any,
    extras?: {
      employerId?: number;
      employerSubTypeId?: number;
      isImpersonating?: boolean;
      impersonatorUserId?: number;
      impersonatorRole?: string;
    },
    ttl?: string,
  ): string {
    const payload: any = {
      sub: user.id,
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      role: user.role,
      roleValue: user.roleValue,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    if (extras?.employerId) payload.employerId = extras.employerId;
    if (extras?.employerSubTypeId) payload.employerSubTypeId = extras.employerSubTypeId;

    if (extras?.isImpersonating) {
      payload.isImpersonating = true;
      payload.impersonatorUserId = extras.impersonatorUserId;
      payload.impersonatorRole = extras.impersonatorRole;
    }

    const signOptions: any = {};
    if (ttl) signOptions.expiresIn = ttl;

    return this.jwtService.sign(payload, Object.keys(signOptions).length ? signOptions : undefined);
  }
}
