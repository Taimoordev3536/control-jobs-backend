import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../../users/entities/role.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<number[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user?.role) {
      this.logger.warn('Access denied: request has no authenticated user/role');
      return false;
    }

    // Ensure role is a Role entity instance
    const role = user.role instanceof Role ? user.role : new Role();
    if (!(user.role instanceof Role)) {
      Object.assign(role, user.role);
    }

    if (typeof role.value !== 'number') {
      this.logger.warn(`Access denied: invalid role value for user ${user.id}`);
      return false;
    }

    const hasRole = requiredRoles.includes(role.value);
    if (!hasRole) {
      this.logger.warn(
        `Access denied for user ${user.id}: role ${role.value} not in [${requiredRoles}]`,
      );
    }

    return hasRole;
  }
}
