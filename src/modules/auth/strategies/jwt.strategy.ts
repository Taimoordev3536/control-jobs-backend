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
import { PartnerUser } from '../../partners/entities/partner-user.entity';
import { EmployerUser } from '../../employers/entities/employer-user.entity';
import { ClientUser } from '../../clients/entities/client-user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private abilityFactory: AbilityFactory,
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
    console.log('JwtStrategy initialized with secret:', secret ? '***' : 'default');
  }

  async validate(payload: any) {
    const user = await this.usersService.findById(payload.id, ['role']);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if ((user as any).isActive === false) {
      throw new UnauthorizedException('Account is deactivated');
    }

    if (!user.role) {
      throw new UnauthorizedException('User has no role assigned');
    }

    const role = new Role();
    Object.assign(role, user.role);

    const userWithRole = new User();
    Object.assign(userWithRole, {
      ...user,
      role,
    });

    const subUserContext = await this.loadSubUserContext(user.id);
    const ability = this.abilityFactory.createForUser(userWithRole, subUserContext);

    return { ...userWithRole, ability, subUser: subUserContext };
  }

  /**
   * Look up whether this user is a sub-user under any parent.
   * A user is a sub-user if any of the junction tables has a row for them
   * with parent_user_id set (and is_default = false).
   */
  private async loadSubUserContext(userId: number): Promise<SubUserContext> {
    const [partnerLink, employerLink, clientLink] = await Promise.all([
      this.partnerUserRepo.findOne({ where: { userId, isDefault: false } }),
      this.employerUserRepo.findOne({ where: { user: { id: userId }, isDefault: false } }),
      this.clientUserRepo.findOne({ where: { userId, isDefault: false } }),
    ]);

    const link = partnerLink ?? employerLink ?? clientLink;

    if (!link || !link.parentUserId) {
      return { isSubUser: false };
    }

    const scopeType = partnerLink
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
