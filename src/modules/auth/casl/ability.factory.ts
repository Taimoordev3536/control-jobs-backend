import { Injectable } from '@nestjs/common';
import {
  AbilityBuilder,
  PureAbility,
  AbilityClass,
  ExtractSubjectType,
  InferSubjects,
} from '@casl/ability';
import { Action } from '../enums/action.enum';
import { User } from '../../users/entities/user.entity';
import { UserRole } from '../enums/user-role.enum';
import { Partner } from '../../partners/entities/partner.entity';
import { Employer } from '../../employers/entities/employer.entity';
import { Client } from '../../clients/entities/client.entity';
import { Worker } from '../../workers/entities/worker.entity';
import { SubUserPermission } from '../enums/sub-user-permission.enum';

type Subjects =
  | InferSubjects<typeof User | typeof Partner | typeof Employer | typeof Client | typeof Worker>
  | 'all';

export type AppAbility = PureAbility<[Action, Subjects]>;

export interface SubUserContext {
  isSubUser: boolean;
  permission?: SubUserPermission | null;
  parentUserId?: number | null;
  scopeType?: 'admin' | 'partner' | 'employer' | 'client' | null;
}

export interface ImpersonationContext {
  isImpersonating: boolean;
  impersonatorUserId?: number | null;
  impersonatorRole?: string | null;
}

@Injectable()
export class AbilityFactory {
  /**
   * Build CASL abilities for a given user.
   *
   * A sub-user inherits the parent's role-based abilities. If their
   * permission is VIEW_ONLY we strip all write actions down to Read.
   */
  createForUser(user: User, subUserContext?: SubUserContext, impersonationContext?: ImpersonationContext) {
    const { can, cannot, build } = new AbilityBuilder<PureAbility<[Action, Subjects]>>(
      PureAbility as AbilityClass<AppAbility>,
    );

    const roleValue = user.role?.value;

    // Base role rules (shared by main users and sub-users alike).
    if (roleValue === UserRole.Admin) {
      can(Action.Manage, 'all');
    } else if (roleValue === UserRole.Partner) {
      can(Action.Read, [Partner, Employer, Client, Worker]);
      can(Action.Create, [Employer, Client, Worker]);
      can(Action.Update, [Employer, Client, Worker]);
      can(Action.Delete, [Employer, Client, Worker]);
    } else if (roleValue === UserRole.Employer) {
      can(Action.Read, [Employer, Client, Worker]);
      can(Action.Create, [Client, Worker]);
      can(Action.Update, [Client, Worker]);
      can(Action.Delete, [Client, Worker]);
    } else if (roleValue === UserRole.Client) {
      can(Action.Read, [Client, Worker]);
      can(Action.Create, [Worker]);
      can(Action.Update, [Worker]);
      can(Action.Delete, [Worker]);
    } else if (roleValue === UserRole.Worker) {
      can(Action.Read, [Worker]);
      can(Action.Update, [Worker]);
    }

    // VIEW_ONLY sub-users lose every write action regardless of role.
    // ADMIN and EDIT sub-users keep full write access for their role.
    if (subUserContext?.isSubUser && subUserContext.permission === SubUserPermission.VIEW_ONLY) {
      cannot(Action.Manage, 'all');
      cannot(Action.Create, 'all');
      cannot(Action.Update, 'all');
      cannot(Action.Delete, 'all');
      cannot(Action.ManageUsers, 'all');
      cannot(Action.ManageRoles, 'all');
    }

    // Sub-users (any permission) cannot manage other sub-users.
    if (subUserContext?.isSubUser) {
      cannot(Action.ManageUsers, 'all');
    }

    // Impersonated sessions: block member management and password changes.
    if (impersonationContext?.isImpersonating) {
      cannot(Action.ManageUsers, 'all');
      cannot(Action.ManageRoles, 'all');
    }

    return build({
      detectSubjectType: (item) => item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
