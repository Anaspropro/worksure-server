import { SetMetadata } from '@nestjs/common';
import { AdminRole } from '../../generated/prisma';

export const ADMIN_ROLES_KEY = 'adminRoles';
export const RequireAdminRole = (...roles: AdminRole[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
