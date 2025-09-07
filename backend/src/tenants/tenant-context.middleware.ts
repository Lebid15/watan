import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { debugEnabled, debugLog } from '../common/debug.util';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantDomain } from './tenant-domain.entity';
import { Tenant } from './tenant.entity';

declare module 'http' {
  interface IncomingMessage {
    tenant?: Tenant;
  }
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(TenantDomain) private domains: Repository<TenantDomain>,
    @InjectRepository(Tenant) private tenants: Repository<Tenant>,
  ) {}

  async use(req: any, res: any, next: () => void) {
    // Resolution priority: X-Tenant-Host > Host > Origin header host
    const originalHost: string | undefined = req.headers.host;
    const xTenantHost: string | undefined = req.headers['x-tenant-host'];
    let originHost: string | undefined;
    const origin = req.headers.origin as string | undefined;
    if (origin && /^https?:\/\//i.test(origin)) {
      try { originHost = new URL(origin).host; } catch {}
    }
    const chosenHost = (xTenantHost || originalHost || originHost || '').split(':')[0];
    const host = chosenHost;
  if (debugEnabled('tenantCtx')) debugLog('tenantCtx', 'incoming', { originalHost, xTenant: xTenantHost, originHost, chosenHost: host, path: req.path });

  let tenant: Tenant | null = null;
    if (host) {
      let domain = await this.domains.findOne({ where: { domain: host } });
      if (domain) {
        tenant = await this.tenants.findOne({ where: { id: domain.tenantId } });
        if (debugEnabled('tenantCtx')) debugLog('tenantCtx', 'matched domain', host, 'tenantId', domain.tenantId);
      } else {
        const base = (process.env.PUBLIC_TENANT_BASE_DOMAIN || 'localhost').toLowerCase();
        const parts = host.split('.');
        // Attempt auto-bind: <code>.<baseDomain>
        if (parts.length >= 2 && host.endsWith('.' + base)) {
          const code = parts[0];
          // Look up tenant by code
          const possibleTenant = await this.tenants.findOne({ where: { code } });
          if (possibleTenant) {
            // Auto-create domain row (idempotent race-safe via check + save)
            const newDomain = this.domains.create({
              tenantId: possibleTenant.id,
              domain: host,
              type: 'subdomain',
              isPrimary: true,
              isVerified: true,
            } as Partial<TenantDomain>) as TenantDomain;
            try {
              await this.domains.save(newDomain);
              domain = newDomain;
              tenant = possibleTenant;
              if (debugEnabled('tenantCtx')) debugLog('tenantCtx', 'auto-bound domain', host, 'tenantId', possibleTenant.id);
              // Ensure only one primary per tenant
              await this.domains.createQueryBuilder()
                .update(TenantDomain)
                .set({ isPrimary: false as any })
                .where('tenantId = :tid AND domain != :d AND isPrimary = true', { tid: possibleTenant.id, d: host })
                .execute();
            } catch (e: any) {
              if (debugEnabled('tenantCtx')) debugLog('tenantCtx', 'auto-bind race or error', e?.message);
              // Another request might have created it; attempt fetch again
              const raced = await this.domains.findOne({ where: { domain: host } });
              if (raced) {
                tenant = await this.tenants.findOne({ where: { id: raced.tenantId } });
              }
            }
          }
        }
  if (!tenant && debugEnabled('tenantCtx')) debugLog('tenantCtx', 'no domain match', host);
      }
    }

    // Fallback: explicit X-Tenant-Id header (integrations)
    if (!tenant) {
      const headerId = (req.headers['x-tenant-id'] as string) || (req.headers['X-Tenant-Id'] as string);
      if (headerId && /^[0-9a-fA-F-]{10,}$/.test(headerId)) {
        tenant = await this.tenants.findOne({ where: { id: headerId } });
      }
    }

    if (tenant) {
      if (!(tenant as any).isActive) throw new NotFoundException('Tenant inactive');
      req.tenant = tenant;
  if (debugEnabled('tenantCtx')) debugLog('tenantCtx', 'attached tenant', { id: tenant.id, code: (tenant as any).code });
    }
    if (!tenant && debugEnabled('tenantCtx')) debugLog('tenantCtx', 'unresolved tenant', { chosenHost: host, originHost, xTenantHost });
    next();
  }
}
