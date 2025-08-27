import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { isFeatureEnabled } from '../common/feature-flags';
import { BillingService } from './billing.service';

// BillingGuard: blocks all /api/tenant/** and /api/tenant/external/** when subscription suspended
// except allows /api/tenant/billing/**, plus always allows auth/health/dev/admin billing.
@Injectable()
export class BillingGuard implements CanActivate {
  constructor(private billing: BillingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!isFeatureEnabled('billingV1')) return true;
    const req: any = context.switchToHttp().getRequest();
    const path: string = req.path || req.url || '';
    const method = (req.method || 'GET').toUpperCase();

    // Always allowed namespaces
    if (/^\/api\/admin\/billing(\/|$)/.test(path)) return true;
    if (/^\/api\/auth(\/|$)/.test(path)) return true;
    if (/^\/api\/health(\/|$)/.test(path)) return true;
    if (/^\/api\/dev(\/|$)/.test(path)) return true;

    const tenantId: string | undefined = req.tenant?.id || req.tenantId;
    if (!tenantId) return true; // no tenant context -> nothing to enforce

    if (!req.subscription) {
      try { req.subscription = await this.billing.fetchSubscription(tenantId); } catch (_) { /* swallow */ }
    }
    const sub = req.subscription;
    if (!sub || sub.status !== 'suspended') return true;

    // Allowed tenant billing paths while suspended
    if (/^\/api\/tenant\/billing(\/|$)/.test(path)) return true;

    const isTenantExternal = /^\/api\/tenant\/external\//.test(path);
    const isTenantAny = /^\/api\/tenant\//.test(path);
    if (isTenantExternal || isTenantAny) {
      throw new ForbiddenException(this.buildSuspendedPayload(sub));
    }
    return true;
  }

  private buildSuspendedPayload(sub: any) {
    return {
      statusCode: 403,
      code: 'TENANT_SUSPENDED',
      message: 'Billing overdue. Please pay to reactivate.',
      ...(sub?.nextDueAt ? { retryAt: sub.nextDueAt.toISOString() } : {}),
    };
  }
}
