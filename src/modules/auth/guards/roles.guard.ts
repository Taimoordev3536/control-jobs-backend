import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../../users/entities/role.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    console.log('RolesGuard: Starting authorization check');

    const requiredRoles = this.reflector.getAllAndOverride<number[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    console.log('RolesGuard: Required roles:', requiredRoles);

    if (!requiredRoles) {
      console.log('RolesGuard: No roles required, access granted');
      return true;
    }

    const request = context.switchToHttp().getRequest();
    console.log('RolesGuard: Request headers:', request.headers);
    console.log('RolesGuard: Full request user object:', JSON.stringify(request.user, null, 2));

    const { user } = request;
    if (!user) {
      console.error('RolesGuard: No user found in request');
      return false;
    }

    if (!user.role) {
      console.error('RolesGuard: No role found in user object');
      return false;
    }

    console.log('RolesGuard: User role object:', JSON.stringify(user.role, null, 2));
    console.log('RolesGuard: User role value:', user.role.value);
    console.log('RolesGuard: Required roles:', requiredRoles);

    // Ensure role is a Role entity instance
    const role = user.role instanceof Role ? user.role : new Role();
    if (!(user.role instanceof Role)) {
      Object.assign(role, user.role);
    }

    // Check if role has a valid value
    if (typeof role.value !== 'number') {
      console.error('Role guard: Invalid role value:', { role });
      return false;
    }

    const hasRole = requiredRoles.includes(role.value);
    console.log('RolesGuard: Has required role?', hasRole);

    if (!hasRole) {
      console.error('RolesGuard: User role not authorized:', {
        userRole: role.value,
        requiredRoles,
      });
    }

    return hasRole;
  }
}
