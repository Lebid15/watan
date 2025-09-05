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
    const rawHeader = Object.keys(req.headers).find(h => h.toLowerCase() === 'api-token');
    const token = rawHeader ? (req.headers as any)[rawHeader] as string : undefined;
    if (!token) throw ErrClientApi.missingToken();
    if (typeof token !== 'string' || token.length !== 40 || !/^[a-f0-9]{40}$/i.test(token)) {
      throw ErrClientApi.tokenError();
    }
    const user = await this.usersRepo.findOne({ where: { apiToken: token } as any });
    if (!user) throw ErrClientApi.tokenError();
    if (user.apiTokenRevoked) throw ErrClientApi.notAllowed();
    if (!user.apiEnabled) throw ErrClientApi.notAllowed();

    // IP allow-list
    const ip = extractNormalizedIp(req.headers['x-forwarded-for'] as any, req.socket?.remoteAddress);
    if (!user.apiAllowAllIps) {
      const list: string[] = Array.isArray(user.apiAllowIps) ? user.apiAllowIps : [];
      if (!ipAllowed(list, ip)) throw ErrClientApi.ipNotAllowed();
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
        throw new ClientApiError(429, 'Rate limit exceeded');
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
