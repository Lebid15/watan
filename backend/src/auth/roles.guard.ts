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
    // نأخذ كلا القيمتين (الأصلية والنهائية) لزيادة التوافق بعد التغييرات الأخيرة
    const roleOriginal = user.role ? String(user.role).toLowerCase() : undefined;
    const roleFinal = user.roleFinal ? String(user.roleFinal).toLowerCase() : undefined;
    if (!roleOriginal && !roleFinal) return false;

    const needed = requiredRoles.map(r => String(r).toLowerCase());

    // تطابق مباشر مع أي من الدورين
    if (roleFinal && needed.includes(roleFinal)) return true;
    if (roleOriginal && needed.includes(roleOriginal)) return true;

    // توافق خاص: اعتبر tenant_owner مكافئاً لـ admin (للمسارات القديمة التي ما زالت تستخدم ADMIN)
    if (roleFinal === 'tenant_owner' && needed.includes('admin')) return true;
    // والعكس (لو مسار يطلب tenant_owner بينما التوكن القديم يحمل admin ولم يحوَّل)
    if (roleOriginal === 'admin' && needed.includes('tenant_owner')) return true;
  // اعتبر tenant_owner مكافئاً لـ instance_owner خلال مرحلة المواءمة
  if (roleFinal === 'tenant_owner' && needed.includes('instance_owner')) return true;
  if (roleOriginal === 'instance_owner' && needed.includes('tenant_owner')) return true;

    // السماح للمطور/مالك المنصة بالوصول لمسارات عالمية حتى بدون tenantId مثل /products/global
    const path: string = (context.switchToHttp().getRequest().path || '').toLowerCase();
  if (path === '/api/products/global' || path.endsWith('/products/global') || path.endsWith('/clone-to-tenant')) {
      if (['developer','instance_owner','tenant_owner'].includes(roleOriginal || '') || ['developer','instance_owner','tenant_owner'].includes(roleFinal || '')) {
        // يكفي أن يكون أي منهما ضمن الأدوار المطلوبة أو مكافئ لها
        if (needed.some(r => ['instance_owner','developer','admin','tenant_owner'].includes(r))) {
          return true;
        }
      }
    }

    return false;
  }
}
