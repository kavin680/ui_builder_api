import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    const { user } = context.switchToHttp().getRequest();
    
    // DEBUG: Log user role for troubleshooting 403 errors
    this.logger.debug(`Request User: ${JSON.stringify(user)}`);
    
    const hasRole = requiredRoles.some((role) => user?.role === role);
    
    if (!hasRole) {
      const userRole = user?.role || 'NONE';
      throw new ForbiddenException(
        `Role '${userRole}' does not have permission to access this resource. Required roles: ${requiredRoles.join(', ')}`,
      );
    }
    
    return true;
  }
}
