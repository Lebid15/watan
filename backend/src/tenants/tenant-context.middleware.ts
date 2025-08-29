import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
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
    if (process.env.DEBUG_TENANT_CTX === '1') {
      // eslint-disable-next-line no-console
      console.log('[TenantCtx][DEBUG] incoming host=%s x-tenant-host=%s path=%s originalUrl=%s', originalHost, req.headers['x-tenant-host'], req.path, req.originalUrl);
    }

  let tenant: Tenant | null = null;
    if (host) {
      const domain = await this.domains.findOne({ where: { domain: host } });
      if (domain) {
        tenant = await this.tenants.findOne({ where: { id: domain.tenantId } });
        if (process.env.DEBUG_TENANT_CTX === '1') {
          // eslint-disable-next-line no-console
          console.log('[TenantCtx][DEBUG] matched tenant_domain domain=%s tenantId=%s', host, domain.tenantId);
        }
      } else if (process.env.DEBUG_TENANT_CTX === '1') {
        // eslint-disable-next-line no-console
        console.log('[TenantCtx][DEBUG] no tenant_domain match for host=%s', host);
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
      if (process.env.DEBUG_TENANT_CTX === '1') {
        // eslint-disable-next-line no-console
        console.log('[TenantCtx][DEBUG] attached tenant id=%s code=%s', tenant.id, (tenant as any).code);
      }
    }
    next();
  }
}
