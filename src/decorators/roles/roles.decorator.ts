import { SetMetadata } from '@nestjs/common';
import { UserRole } from 'src/utils/enum';

export const Roles = (...roles: UserRole[]) => {
  return SetMetadata('roles', roles);
};
