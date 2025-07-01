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

type Subjects = InferSubjects<typeof User | typeof Partner | typeof Employer | typeof Client | typeof Worker> | 'all';

export type AppAbility = PureAbility<[Action, Subjects]>;

@Injectable()
export class AbilityFactory {
  createForUser(user: User) {
    const { can, cannot, build } = new AbilityBuilder<
      PureAbility<[Action, Subjects]>
    >(PureAbility as AbilityClass<AppAbility>);

    if (user.role.value === UserRole.Admin) {
      can(Action.Manage, 'all'); // Admin can do everything
    } else if (user.role.value === UserRole.Partner) {
      can(Action.Read, [Partner, Employer, Client, Worker]);
      can(Action.Create, [Employer, Client, Worker]);
      can(Action.Update, [Employer, Client, Worker]);
      can(Action.Delete, [Employer, Client, Worker]);
    } else if (user.role.value === UserRole.Employer) {
      can(Action.Read, [Employer, Client, Worker]);
      can(Action.Create, [Client, Worker]);
      can(Action.Update, [Client, Worker]);
      can(Action.Delete, [Client, Worker]);
    } else if (user.role.value === UserRole.Client) {
      can(Action.Read, [Client, Worker]);
      can(Action.Create, [Worker]);
      can(Action.Update, [Worker]);
      can(Action.Delete, [Worker]);
    } else if (user.role.value === UserRole.Worker) {
      can(Action.Read, [Worker]);
      can(Action.Update, [Worker]);
    }

    return build({
      detectSubjectType: (item) =>
        item.constructor as ExtractSubjectType<Subjects>,
    });
  }
}
