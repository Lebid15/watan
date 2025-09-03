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
    // استخراج Host من الـ request headers أو من X-Tenant-Host للـ frontend
    const originalHost = req.headers.host;
    const tenantHost = req.headers['x-tenant-host'] || originalHost;
    const host = (tenantHost || '').split(':')[0]; // ex: kadro.localhost
  if (debugEnabled('tenantCtx')) debugLog('tenantCtx', 'incoming', { originalHost, xTenant: req.headers['x-tenant-host'], path: req.path, url: req.originalUrl });

  let tenant: Tenant | null = null;
    if (host) {
      const domain = await this.domains.findOne({ where: { domain: host } });
      if (domain) {
        tenant = await this.tenants.findOne({ where: { id: domain.tenantId } });
        if (debugEnabled('tenantCtx')) debugLog('tenantCtx', 'matched domain', host, 'tenantId', domain.tenantId);
      } else {
        // Fallback: handle www.syrz1.com by redirecting to sham.syrz1.com logic
        if (host === 'www.syrz1.com') {
          const fallbackDomain = await this.domains.findOne({ where: { domain: 'sham.syrz1.com' } });
          if (fallbackDomain) {
            tenant = await this.tenants.findOne({ where: { id: fallbackDomain.tenantId } });
            if (debugEnabled('tenantCtx')) debugLog('tenantCtx', 'fallback domain match', 'www.syrz1.com -> sham.syrz1.com', 'tenantId', fallbackDomain.tenantId);
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
    next();
  }
}
