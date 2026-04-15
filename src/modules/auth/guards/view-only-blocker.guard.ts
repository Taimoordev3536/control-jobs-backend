import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SubUserPermission } from '../enums/sub-user-permission.enum';

/**
 * Interceptor (not guard) so it runs AFTER JwtAuthGuard populates req.user.
 *
 * Blocks mutating HTTP methods for VIEW_ONLY sub-users. This is a
 * defense-in-depth layer on top of CASL: controllers that don't use
 * @CheckPolicies would otherwise let a VIEW_ONLY sub-user write.
 *
 * Safe when req.user is absent (public endpoints) or caller is not a
 * VIEW_ONLY sub-user.
 */
@Injectable()
export class ViewOnlyBlockerInterceptor implements NestInterceptor {
  private readonly writeAllowlist = [
    '/auth/logout',
    '/sub-users/accept-invite',
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'OPTIONS' || method === 'HEAD') {
      return next.handle();
    }

    const user = req.user;
    const isViewOnlySub =
      user?.subUser?.isSubUser &&
      user.subUser.permission === SubUserPermission.VIEW_ONLY;

    if (!isViewOnlySub) return next.handle();

    const url: string = req.originalUrl || req.url || '';
    if (this.writeAllowlist.some((suffix) => url.includes(suffix))) {
      return next.handle();
    }

    throw new ForbiddenException('Your access is read-only');
  }
}
