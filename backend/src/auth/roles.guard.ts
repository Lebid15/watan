import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from './user-role.enum';  // تأكد من المسار الصحيح

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler());
    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // لا قيود
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user || {};
    const roleRaw: string | undefined = user.roleFinal || user.role;
    if (!roleRaw) return false;
    const roleLower = String(roleRaw).toLowerCase();
    const needed = requiredRoles.map(r => String(r).toLowerCase());

    // Allow developer or instance_owner even without tenantId for global-scoped routes like /products/global
    if (!user.tenantId && ['developer','instance_owner'].includes(roleLower)) {
      return needed.includes(roleLower);
    }
    return needed.includes(roleLower);
  }
}
