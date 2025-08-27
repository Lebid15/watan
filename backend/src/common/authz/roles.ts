// Phase 1: تعريف الأدوار النهائية + مواءمة مؤقتة
export type FinalRole = 'instance_owner' | 'tenant_owner' | 'distributor' | 'end_user';

// مواءمة الأدوار القديمة إلى النهائية
export function mapLegacyRole(r?: string): FinalRole {
  const v = (r || '').toLowerCase();
  // Preserve already-final roles explicitly
  if (v === 'tenant_owner') return 'tenant_owner';
  if (v === 'admin') return 'tenant_owner';
  if (v === 'user') return 'end_user';
  if (v === 'developer') return 'instance_owner'; // وصول منصّة مؤقت
  if (v === 'distributor') return 'distributor';
  if (v === 'instance_owner') return 'instance_owner';
  // أدوار غير معروفة تعامل كمستخدم نهائي
  return 'end_user';
}

// Decorator لتحديد الأدوار النهائية المطلوبة
import { SetMetadata, createParamDecorator, ExecutionContext, CanActivate, Injectable } from '@nestjs/common';
export const FINAL_ROLES_KEY = 'final_roles_required';
export const FinalRoles = (...roles: FinalRole[]) => SetMetadata(FINAL_ROLES_KEY, roles);

// حارس يعتمد على roleFinal المحقون في req.user
@Injectable()
export class FinalRolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const required: FinalRole[] | undefined = (Reflect as any).getMetadata(FINAL_ROLES_KEY, context.getHandler());
    if (!required || required.length === 0) return true;
    const user = req.user;
    if (!user || !user.roleFinal) return false;
    return required.includes(user.roleFinal);
  }
}

// ديكور بسيط للوصول إلى الدور النهائي داخل الهاندلر
export const CurrentFinalRole = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return req.user?.roleFinal as FinalRole | undefined;
});
