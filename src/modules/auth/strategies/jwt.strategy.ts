import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../../users/users.service';
import { AbilityFactory, SubUserContext } from '../casl/ability.factory';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { AdminUser } from '../../users/entities/admin-user.entity';
import { PartnerUser } from '../../partners/entities/partner-user.entity';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { ClientUser } from '../../clients/entities/client-user.entity';

interface CachedAuth {
  user: User;
  subUser: SubUserContext;
  expiresAt: number;
}

// The user + role + sub-user context lookups ran on EVERY request (5
// queries, each paying the remote-DB round trip). The result changes
// rarely, so cache it per user for a short TTL: deactivation / role /
// permission changes still take effect within a minute, but steady-state
// requests hit the DB zero times for auth.
const AUTH_CACHE_TTL_MS = 60_000;
const AUTH_CACHE_MAX_ENTRIES = 5_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly authCache = new Map<number, CachedAuth>();

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private abilityFactory: AbilityFactory,
    @InjectRepository(AdminUser)
    private adminUserRepo: Repository<AdminUser>,
    @InjectRepository(PartnerUser)
    private partnerUserRepo: Repository<PartnerUser>,
    @InjectRepository(EmployerUser)
    private employerUserRepo: Repository<EmployerUser>,
    @InjectRepository(ClientUser)
    private clientUserRepo: Repository<ClientUser>,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      console.warn('JWT_SECRET is not set in environment variables, using default secret');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    let cached = this.authCache.get(payload.id);
    if (!cached || cached.expiresAt <= Date.now()) {
      const user = await this.usersService.findById(payload.id, ['role']);

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if ((user as any).isActive === false) {
        this.authCache.delete(payload.id);
        throw new UnauthorizedException('Account is deactivated');
      }

      if (!user.role) {
        throw new UnauthorizedException('User has no role assigned');
      }

      const subUser = await this.loadSubUserContext(user.id);
      cached = { user, subUser, expiresAt: Date.now() + AUTH_CACHE_TTL_MS };
      this.authCache.set(payload.id, cached);

      if (this.authCache.size > AUTH_CACHE_MAX_ENTRIES) {
        const now = Date.now();
        for (const [key, entry] of this.authCache) {
          if (entry.expiresAt <= now) this.authCache.delete(key);
        }
      }
    }

    // Fresh instances per request so downstream mutations of req.user
    // can't leak into the cache.
    const role = new Role();
    Object.assign(role, cached.user.role);

    const userWithRole = new User();
    Object.assign(userWithRole, {
      ...cached.user,
      role,
    });

    const subUserContext = cached.subUser;

    const impersonationContext = {
      isImpersonating: payload.isImpersonating || false,
      impersonatorUserId: payload.impersonatorUserId || null,
      impersonatorRole: payload.impersonatorRole || null,
    };

    const ability = this.abilityFactory.createForUser(userWithRole, subUserContext, impersonationContext);

    return { ...userWithRole, ability, subUser: subUserContext, impersonation: impersonationContext };
  }

  /**
   * Look up whether this user is a sub-user under any parent.
   * A user is a sub-user if any of the junction tables has a row for them
   * with parent_user_id set (and is_default = false).
   */
  private async loadSubUserContext(userId: number): Promise<SubUserContext> {
    const [adminLink, partnerLink, employerLink, clientLink] = await Promise.all([
      this.adminUserRepo.findOne({ where: { userId, isDefault: false } }),
      this.partnerUserRepo.findOne({ where: { userId, isDefault: false } }),
      this.employerUserRepo.findOne({ where: { user: { id: userId }, isDefault: false } }),
      this.clientUserRepo.findOne({ where: { userId, isDefault: false } }),
    ]);

    const link = adminLink ?? partnerLink ?? employerLink ?? clientLink;

    if (!link || !link.parentUserId) {
      return { isSubUser: false };
    }

    const scopeType = adminLink
      ? 'admin'
      : partnerLink
        ? 'partner'
        : employerLink
          ? 'employer'
          : 'client';

    return {
      isSubUser: true,
      permission: link.permission,
      parentUserId: link.parentUserId,
      scopeType,
    };
  }
}
