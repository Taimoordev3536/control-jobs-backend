import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<number[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true; // No role requirements specified, access is allowed
    }

    const { user } = context.switchToHttp().getRequest();

    // Check if user exists and has a role with a value
    if (!user || !user.role || user.roleValue === undefined) {
      return false;
    }

    // Check if user's role value is in the list of required roles
    return requiredRoles.includes(user.roleValue);
  }
}
