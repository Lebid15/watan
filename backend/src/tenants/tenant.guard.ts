import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { debugEnabled, debugLog } from '../common/debug.util';
import { Reflector } from '@nestjs/core';

// Whitelisted public routes (no tenant or auth required)
const PUBLIC_PATHS: RegExp[] = [
  /^\/api\/health$/,
  /^\/api\/ready$/,
  /^\/(api\/)?metrics$/,
  /^\/api\/auth\/login$/,
  /^\/api\/auth\/register$/,
  /^\/api\/auth\/logout$/,
  /^\/api\/auth\/request-password-reset$/,
  /^\/api\/auth\/reset-password$/,
  /^\/api\/auth\/request-email-verification$/,
  /^\/api\/auth\/verify-email$/,
  /^\/api\/auth\/bootstrap-developer$/,
  // السماح بإصدار dev-token بدون مصادقة مسبقة (محمي بالسر DEV_ISSUE_SECRET) - دعم مع وبدون البادئة /api
  /^\/auth\/dev-token$/,
  /^\/api\/auth\/dev-token$/,
  /^\/api\/auth\/assume-tenant$/,
  /^\/api\/auth\/passkeys\/options\/register$/,
  /^\/api\/auth\/passkeys\/register$/,
  /^\/api\/auth\/passkeys\/options\/login$/,
  /^\/api\/auth\/passkeys\/login$/,
  /^\/api\/dev\/filtered-products-sync$/, // POST sync
  /^\/api\/dev\/filtered-products-sync\/status$/, // GET status
  /^\/api\/dev\/filtered-products-sync\/repair$/, // POST/GET repair
  /^\/api\/dev\/seed-products$/, // POST seed demo products
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
  // Allow dev-token issuance regardless of prefix variations (defensive)
  if (path.includes('auth/dev-token')) return true;
    // DEBUG (مؤقت): اطبع المسار وقرار التخطّي
  if (debugEnabled('tenantGuard')) debugLog('tenantGuard', 'evaluate', { path, original, pub: PUBLIC_PATHS.some(r=>r.test(path)), noTenant: NO_TENANT_REQUIRED_PATHS.some(r=>r.test(path)) });

  if (PUBLIC_PATHS.some(r => r.test(path))) return true;

  // Allow certain legacy global-scope admin routes to pass without tenant; JWT & Roles/FinalRoles will run after us.
  if (NO_TENANT_REQUIRED_PATHS.some(r => r.test(path))) return true;

  const isTenantPath = /^\/(api\/)?tenant\//.test(path);
  const isAdminPath  = /^\/(api\/)?admin\//.test(path);
  const isDevPath    = /^\/(api\/)?dev\//.test(path);
  const isAppPath    = /^\/(api\/)?app\//.test(path);
  const isExternalTenantPath = /^\/(api\/)?tenant\/external\/v1\//.test(path);

    // JWT user injected by auth guard earlier (assume global order: auth -> tenant guard) or manually attached.
    const user = req.user;
    const tenant = req.tenant;

  // External tenant API paths rely on ExternalAuthGuard (controller-level) to attach tenant after this guard
  if (isExternalTenantPath) return true;
  if (isTenantPath && !tenant) throw new UnauthorizedException('Tenant context required');

  if (!user && !req.externalToken) {
      // Defer auth evaluation to JwtAuthGuard / RolesGuard if an Authorization header OR auth cookie is present.
      // This avoids ordering issues where this global guard runs before controller-level JwtAuthGuard.
      const hasAuthHeader = !!(req.headers && req.headers.authorization);
      const hasAuthCookie = !!(req.cookies && req.cookies.auth);
      if (debugEnabled('jwt','tenantGuard')) debugLog('tenantGuard', 'pre-defer', { path, hasAuthHeader, hasAuthCookie, rawCookieLen: (req.headers && (req.headers.cookie||'')).length });
      if (hasAuthHeader || hasAuthCookie) {
        if (debugEnabled('jwt','tenantGuard')) debugLog('tenantGuard', 'deferring to JwtAuthGuard', { hasAuthHeader, hasAuthCookie, path });
        return true; // allow next guards to populate req.user
      }
      throw new UnauthorizedException('Auth required');
    }

    // If we have both a resolved tenant (via domain/header) and a JWT user whose tenantId differs,
    // treat it as a tenant context mismatch (e.g., developer/global token reused on a storefront subdomain).
    // We allow developer / instance_owner to proceed (global scope) so they can access global pages without forced logout.
    if (tenant && user) {
      const userTenantId = user.tenantId ?? null;
      const roleLower = (user.role || '').toLowerCase();
      const isGlobalRole = roleLower === 'developer' || roleLower === 'instance_owner';
      if (userTenantId && tenant.id !== userTenantId && !isGlobalRole) {
  if (debugEnabled('tenantGuard')) debugLog('tenantGuard', 'TENANT_MISMATCH diff ids', { userTenantId, tenantId: tenant.id, roleLower, path });
        throw new UnauthorizedException('TENANT_MISMATCH');
      }
      if (!userTenantId && tenant.id && !isGlobalRole) {
  if (debugEnabled('tenantGuard')) debugLog('tenantGuard', 'TENANT_MISMATCH null user tenantId', { tenantId: tenant.id, roleLower, path });
        throw new UnauthorizedException('TENANT_MISMATCH');
      }
    }

    // Enforce tenant ownership/distributor constraints only on tenant paths
    if (isTenantPath) {
      if (isExternalTenantPath && req.externalToken) {
        if (req.externalToken.tenantId !== tenant.id) throw new ForbiddenException('Cross-tenant access (external)');
        // no role enforcement for external token usage
      } else {
        if (!user) throw new UnauthorizedException('Auth required');
        if (user.tenantId !== tenant.id) throw new ForbiddenException('Cross-tenant access blocked');
        const finalRole = user.roleFinal || user.role; // fallback to legacy if not injected
        if (!['tenant_owner', 'distributor'].includes(finalRole)) {
          throw new ForbiddenException('Role not permitted for tenant API');
        }
      }
    }
    // Admin/dev/app paths don't require tenant impersonation here; FinalRolesGuard will restrict roles.
    return true;
  }
}
