import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { AbilityFactory } from '../casl/ability.factory';
import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private abilityFactory: AbilityFactory,
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

    if (!user.role) {
      throw new UnauthorizedException('User has no role assigned');
    }

    // Create a proper Role entity instance
    const role = new Role();
    Object.assign(role, user.role);

    // Create a proper User entity instance with the role
    const userWithRole = new User();
    Object.assign(userWithRole, {
      ...user,
      role: role
    });

    const ability = this.abilityFactory.createForUser(userWithRole);
    return { ...userWithRole, ability };
  }
}
