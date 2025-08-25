import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

// Whitelisted public routes (no tenant or auth required)
const PUBLIC_PATHS: RegExp[] = [
  /^\/api\/health$/,
  /^\/api\/ready$/,
  /^\/(api\/)?metrics$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/register$/,
  /^\/api\/auth\/request-password-reset$/,
  /^\/api\/auth\/reset-password$/,
  /^\/api\/auth\/request-email-verification$/,
  /^\/api\/auth\/verify-email$/,
  /^\/api\/auth\/bootstrap-developer$/,
  /^\/api\/auth\/assume-tenant$/,
  /^\/api\/auth\/passkeys\/options\/register$/,
  /^\/api\/auth\/passkeys\/register$/,
  /^\/api\/auth\/passkeys\/options\/login$/,
  /^\/api\/auth\/passkeys\/login$/,
  // Public catalog product listing (image fallback test)
  /^\/api\/products$/,
  /^\/api\/products\/[0-9a-fA-F-]{10,}$/,
  /^\/api\/docs(\/|$)/,
];

// Routes that still require auth/roles (handled at controller) but do NOT require a tenant context.
// We short‑circuit tenant checks here so developer / instance_owner can manage global dev providers.
// Support both with and without the global prefix (/api) because req.path in Nest can exclude the prefix
// (Express gives originalUrl='/api/...', path may be '/admin/...'). So we allow optional (api/)? group.
const NO_TENANT_REQUIRED_PATHS: RegExp[] = [
  /^\/(api\/)?admin\/providers\/dev(\/?|$)/,
  /^\/(api\/)?admin\/providers\/[^/]+\/catalog-import(\/|$)/,
  /^\/(api\/)?admin\/providers\/import-jobs\/[^/]+$/,
  /^\/(api\/)?admin\/catalog\/products(\/?|$)/,
  /^\/(api\/)?admin\/catalog\/products\/[^/]+\/packages$/,
  /^\/(api\/)?admin\/tenants(\/?|$)/,
  /^\/(api\/)?admin\/stats(\/?|$)/,
  /^\/(api\/)?dev\/errors(\/?|$)/,
  /^\/(api\/)?admin\/upload(\/?|$)/,
  // metrics endpoints accessible with auth but without tenant impersonation
  /^\/(api\/)?admin\/products\/image-metrics\/latest$/,
  /^\/(api\/)?admin\/products\/image-metrics\/delta$/,
];

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req: any = context.switchToHttp().getRequest();
  const path = req.path || req.url || '';
  const original = req.originalUrl || '';
    // DEBUG (مؤقت): اطبع المسار وقرار التخطّي
    if (process.env.DEBUG_TENANT_GUARD === '1') {
      const pub = PUBLIC_PATHS.some(r => r.test(path));
      const noTenant = NO_TENANT_REQUIRED_PATHS.some(r => r.test(path));
      // eslint-disable-next-line no-console
  console.log('[TenantGuard][DEBUG] path=%s original=%s pub=%s noTenant=%s', path, original, pub, noTenant);
    }

  if (PUBLIC_PATHS.some(r => r.test(path))) return true;

  // Allow certain global-scope admin routes to pass without tenant; JWT & RolesGuard will run after us.
  if (NO_TENANT_REQUIRED_PATHS.some(r => r.test(path))) return true;

    // JWT user injected by auth guard earlier (assume global order: auth -> tenant guard) or manually attached.
    const user = req.user;
    const tenant = req.tenant;

    // Must have tenant context for any protected route unless elevated WITHOUT impersonation is still global (no tenant access)
    if (!tenant) throw new UnauthorizedException('Tenant context required');

    if (!user) {
      // Defer auth evaluation to JwtAuthGuard / RolesGuard if an Authorization header is present.
      // This avoids ordering issues where this global guard runs before controller-level JwtAuthGuard.
      if (req.headers && req.headers.authorization) {
        return true; // allow next guards to populate req.user
      }
      throw new UnauthorizedException('Auth required');
    }

  // المطور فقط يُسمح له بالوصول بعد الانتحال في سياق تينانت
  if (user.role === 'developer') {
      if (!user.tenantId || user.tenantId !== tenant.id) {
        // Not impersonated properly
        throw new ForbiddenException('Impersonation required for tenant access');
      }
    } else {
      // Regular user must match tenant
      if (user.tenantId !== tenant.id) {
        throw new ForbiddenException('Cross-tenant access blocked');
      }
    }
    return true;
  }
}
