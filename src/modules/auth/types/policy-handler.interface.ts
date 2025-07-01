import { AppAbility } from '../casl/ability.factory';

export type PolicyHandler = (ability: AppAbility) => boolean;
