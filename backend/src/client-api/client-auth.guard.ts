import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { User } from '../user/user.entity';
import { ErrClientApi, ClientApiError } from './client-api-error';
import { extractNormalizedIp, ipAllowed } from './client-api-ip.util';

@Injectable()
export class ClientApiAuthGuard implements CanActivate {
  constructor(@InjectRepository(User) private usersRepo: Repository<User>) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req: any = ctx.switchToHttp().getRequest();
    // Official header: api-token ; Backwards compatibility: x-api-token
    const rawHeader = Object.keys(req.headers || {}).find(h => {
      const hl = h.toLowerCase();
      return hl === 'api-token' || hl === 'x-api-token';
    });
    const token = rawHeader ? (req.headers as any)[rawHeader] as string : undefined;
    if (!token) throw new ClientApiError(120, 'Api Token is required', { reason: 'missing_token' });
    if (typeof token !== 'string') throw new ClientApiError(121, 'Token error', { reason: 'non_string' });
    if (token.length !== 40 || !/^[a-f0-9]{40}$/i.test(token)) {
      throw new ClientApiError(121, 'Token error', { reason: 'invalid_format' });
    }
    let user: any;
    try {
      user = await this.usersRepo.findOne({ where: { apiToken: token } as any });
    } catch (e) {
      throw new ClientApiError(121, 'Token error', { reason: 'lookup_failed' });
    }
    if (!user) throw new ClientApiError(121, 'Token error', { reason: 'not_found' });
    if (user.apiTokenRevoked) throw new ClientApiError(121, 'Token error', { reason: 'revoked' });
    if (!user.apiEnabled) throw new ClientApiError(121, 'Token error', { reason: 'disabled' });

    // IP allow-list
    const ip = extractNormalizedIp(req.headers['x-forwarded-for'] as any, req.socket?.remoteAddress);
    if (!user.apiAllowAllIps) {
      const list: string[] = Array.isArray(user.apiAllowIps) ? user.apiAllowIps : [];
  if (!ipAllowed(list, ip)) throw new ClientApiError(123, 'IP not allowed', { reason: 'ip_not_allowed', ip, allow: list });
    }
    if (process.env.MAINTENANCE === '1') {
      throw ErrClientApi.maintenance();
    }

    // Rate limiting (simple per-minute count from logs if limit set)
    if (user.apiRateLimitPerMin && user.apiRateLimitPerMin > 0) {
      const since = new Date(Date.now() - 60_000);
      // lightweight count using raw query to avoid extra entity cost
      const cntRows = await this.usersRepo.query(`SELECT count(*)::int AS c FROM client_api_request_logs WHERE "userId"=$1 AND "createdAt" > $2`, [user.id, since]);
      const count = cntRows?.[0]?.c || 0;
      if (count >= user.apiRateLimitPerMin) {
  throw new ClientApiError(429, 'Rate limit exceeded', { reason: 'rate_limited', limit: user.apiRateLimitPerMin });
      }
    }

    // Attach context
    req.clientApiUser = user;
    req.tenant = { id: user.tenantId };

    // Update last used at async
  this.usersRepo.update(user.id, { apiLastUsedAt: new Date() }).catch(()=>{});
    return true;
  }
}
