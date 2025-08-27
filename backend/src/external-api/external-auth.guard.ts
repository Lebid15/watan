import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { TenantApiToken } from './tenant-api-token.entity';
import { User } from '../user/user.entity';

function sha256Hex(s: string) {
  return crypto.createHash('sha256').update(s).digest('hex');
}

@Injectable()
export class ExternalAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(TenantApiToken) private tokensRepo: Repository<TenantApiToken>,
    @InjectRepository(User) private usersRepo: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req: any = ctx.switchToHttp().getRequest();
    const auth = req.headers['authorization'] || req.headers['Authorization'];
    if (!auth || typeof auth !== 'string' || !auth.toLowerCase().startsWith('bearer ')) {
  throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'INVALID_TOKEN' });
    }
    const raw = auth.slice(7).trim();
    const parts = raw.split('.');
  if (parts.length !== 2) throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'INVALID_TOKEN' });
    const [prefix, secret] = parts;
  if (!prefix || !secret || prefix.length > 8) throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'INVALID_TOKEN' });

    const token = await this.tokensRepo.findOne({ where: { tokenPrefix: prefix } as any });
  if (!token) {
    throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'INVALID_TOKEN' });
  }
  if (!token.isActive) throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'INVALID_TOKEN' });
  if (token.expiresAt && token.expiresAt < new Date()) throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'INVALID_TOKEN' });

    const hash = sha256Hex(secret);
  if (hash !== token.tokenHash) throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'INVALID_TOKEN' });

    const user = await this.usersRepo.findOne({ where: { id: token.userId } as any });
  if (!user) throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'INVALID_TOKEN' });
  if (!user.apiEnabled) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'FORBIDDEN' });

    // Attach context
    let scopes: string[];
    try { scopes = JSON.parse(token.scopes); if (!Array.isArray(scopes)) scopes = []; } catch { scopes = []; }
    req.externalToken = { tokenId: token.id, tenantId: token.tenantId, userId: token.userId, scopes };
    req.user = user; // for downstream maybe (limited)
    req.tenant = { id: token.tenantId };

    // Update lastUsedAt (fire and forget)
    this.tokensRepo.update(token.id, { lastUsedAt: new Date() }).catch(()=>{});

    return true;
  }
}
