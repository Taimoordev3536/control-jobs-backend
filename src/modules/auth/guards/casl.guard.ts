import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppAbility } from '../casl/ability.factory';
import { CHECK_POLICIES_KEY } from '../decorators/check-policies.decorator';
import { PolicyHandler } from '../types/policy-handler.interface';

@Injectable()
export class CaslGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) || [];

    if (!policyHandlers.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const ability = user.ability as AppAbility;

    const results = await Promise.all(
      policyHandlers.map((handler) => handler(ability))
    );

    if (!results.every((result) => result)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }

    return true;
  }
}
