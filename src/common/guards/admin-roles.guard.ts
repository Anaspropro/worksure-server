import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminRole, UserRole } from '../../generated/prisma';
import { ADMIN_ROLES_KEY } from '../decorators/admin-roles.decorator';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminRolesGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      return false;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, adminRoles: true },
    });

    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('User is not an admin');
    }

    if (user.adminRoles.includes('SUPER_ADMIN')) {
      return true; // SUPER_ADMIN can access anything
    }

    const hasRole = requiredRoles.some((role) => user.adminRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('Insufficient admin privileges for this operation');
    }

    return true;
  }
}
