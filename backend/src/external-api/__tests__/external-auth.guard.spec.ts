import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ExternalAuthGuard } from '../external-auth.guard';
import { TenantApiToken } from '../tenant-api-token.entity';
import { User } from '../../user/user.entity';
import * as crypto from 'crypto';

class FakeRepo<T extends { id?: any }> {
  data: T[] = [];
  constructor(private idPrefix: string) {}
  findOne(opts: any): Promise<T | null> {
    const where = opts?.where || {};
    return Promise.resolve(this.data.find(r => Object.entries(where).every(([k,v]) => (r as any)[k] === v)) || null);
  }
  update(id: any, patch: any) { const row = this.data.find(r => r.id === id); if (row) Object.assign(row, patch); return Promise.resolve({}); }
  push(obj: T) { if (!obj.id) obj.id = this.idPrefix + (this.data.length+1); this.data.push(obj); return obj; }
}

function mockCtx(headers: Record<string,string>): any {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }), getResponse: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('ExternalAuthGuard', () => {
  let guard: ExternalAuthGuard;
  let usersRepo: FakeRepo<User & { apiEnabled?: boolean | null }>;
  let tokensRepo: FakeRepo<TenantApiToken & { expiresAt?: Date | null; isActive: boolean; scopes: string; tokenHash: string; tokenPrefix: string; tenantId: string; userId: string }>;

  beforeAll(() => {
  usersRepo = new FakeRepo<User & { apiEnabled?: boolean | null }>('u');
    tokensRepo = new FakeRepo<TenantApiToken>('t');
    // @ts-ignore inject repositories manually
    guard = new ExternalAuthGuard(tokensRepo as any, usersRepo as any);
  });

  it('INVALID_TOKEN when header missing', async () => {
    await expect(guard.canActivate(mockCtx({}))).rejects.toThrow(UnauthorizedException);
  });

  it('INVALID_TOKEN for malformed token', async () => {
    await expect(guard.canActivate(mockCtx({ authorization: 'Bearer abc' }))).rejects.toThrow(UnauthorizedException);
  });

  it('updates lastUsedAt on success', async () => {
    const secret = 's123456789012345678901234567890';
    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    const user = usersRepo.push({ id: 'u1', tenantId: 'ten1', email: 'a', password: 'p', role: 'user', apiEnabled: true } as any);
    const token = tokensRepo.push({ id: 'tok1', tenantId: 'ten1', userId: user.id, tokenPrefix: 'pf1', tokenHash: hash, scopes: JSON.stringify(['ping']), isActive: true } as any);
    const ctx = mockCtx({ authorization: 'Bearer pf1.' + secret });
    await guard.canActivate(ctx);
    expect(tokensRepo.data[0].lastUsedAt).toBeInstanceOf(Date);
  });

  it('INVALID_TOKEN when token disabled', async () => {
    const secret = 'sdisabledtoken1234567890';
    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    const user = usersRepo.push({ id: 'u2', tenantId: 'ten1', email: 'b', password: 'p', role: 'user', apiEnabled: true } as any);
    tokensRepo.push({ id: 'tok2', tenantId: 'ten1', userId: user.id, tokenPrefix: 'pf2', tokenHash: hash, scopes: '[]', isActive: false } as any);
    await expect(guard.canActivate(mockCtx({ authorization: 'Bearer pf2.' + secret }))).rejects.toThrow(UnauthorizedException);
  });

  it('INVALID_TOKEN when token expired', async () => {
    const secret = 'sexpiredtoken1234567890';
    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    const user = usersRepo.push({ id: 'u3', tenantId: 'ten1', email: 'c', password: 'p', role: 'user', apiEnabled: true } as any);
    tokensRepo.push({ id: 'tok3', tenantId: 'ten1', userId: user.id, tokenPrefix: 'pf3', tokenHash: hash, scopes: '[]', isActive: true, expiresAt: new Date(Date.now()-1000) } as any);
    await expect(guard.canActivate(mockCtx({ authorization: 'Bearer pf3.' + secret }))).rejects.toThrow(UnauthorizedException);
  });
});
