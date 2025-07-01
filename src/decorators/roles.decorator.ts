import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

// Decorator that takes role values (numbers) as parameters
// Example usage: @Roles(1, 2) - Allow only Admin (1) and Partner (2) roles
export const Roles = (...roles: number[]) => SetMetadata(ROLES_KEY, roles);
