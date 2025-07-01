import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private reflector?: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    console.log('Creating receipt for user:');

    const request = context.switchToHttp().getRequest();
    const user = request.user; // User object is set by JwtAuthGuard

    // Check if user exists and has isAdmin flag set to true
    return user && user.isAdmin === true;
  }
}
