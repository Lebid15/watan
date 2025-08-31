import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from './user-role.enum';  // تأكد من المسار الصحيح

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const path = request.url || '';

    if (!user || !user.role) {
      return false;
    }

    const roleLower = String(user.role).toLowerCase();
    
    if (path.startsWith('/dev')) {
      return roleLower === UserRole.DEVELOPER;
    }
    if (path.startsWith('/admin')) {
      return roleLower === UserRole.INSTANCE_OWNER;
    }

    const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler());
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    if (!user.tenantId && roleLower !== UserRole.DEVELOPER) return false;
    
    const needed = requiredRoles.map(r => String(r).toLowerCase());
    return needed.includes(roleLower);
  }
}
