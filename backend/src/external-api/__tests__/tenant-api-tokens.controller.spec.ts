import { TenantApiTokensController } from '../tenant-api-tokens.controller';
import { TenantApiTokenService } from '../tenant-api-tokens.service';
import { ForbiddenException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';

class FakeService implements Partial<TenantApiTokenService> {
  tokens: any[] = [];
  async createToken(tenantId: string, userId: string, scopes: string[], name?: string, expiresAt?: Date | null) {
    const t = { id: 'tok'+(this.tokens.length+1), tenantId, userId, scopes: JSON.stringify(scopes), isActive: true };
    this.tokens.push(t);
    return { token: 'pf.secret', prefix: 'pf', scopes, expiresAt: expiresAt || null };
  }
  async listUserTokens(userId: string, tenantId: string) { return this.tokens.filter(t => t.userId===userId && t.tenantId===tenantId); }
  async updateToken(tokenId: string, tenantId: string, body: any) { const t = this.tokens.find(x=>x.id===tokenId && x.tenantId===tenantId); if(!t) throw new NotFoundException('Token not found'); Object.assign(t, body); return t; }
  async deleteToken(tokenId: string, tenantId: string) { const idx = this.tokens.findIndex(x=>x.id===tokenId && x.tenantId===tenantId); if(idx<0) throw new NotFoundException('Token not found'); this.tokens.splice(idx,1); return { deleted:true }; }
}

// Minimal fake users repo
class FakeUsersRepo { users: any[] = []; findOne(opts:any){ const where = opts.where||{}; return Promise.resolve(this.users.find(u=>Object.entries(where).every(([k,v])=>u[k]===v))||null); } }

function makeReq(role: string, tenantId: string, userOverrides: any = {}) {
  return { user: { id: 'uidX', role, roleFinal: role, ...userOverrides }, tenant: { id: tenantId } };
}

describe('TenantApiTokensController', () => {
  let ctl: TenantApiTokensController; let service: FakeService; let usersRepo: FakeUsersRepo;
  const tenantId = 'ten1'; const otherTenant = 'ten2';
  beforeEach(() => { service = new FakeService(); usersRepo = new FakeUsersRepo(); ctl = new TenantApiTokensController(service as any, usersRepo as any); });

  it('forbids non-owner create', async () => {
    await expect(ctl.create(makeReq('user', tenantId) as any, 'u1', { scopes: [] })).rejects.toThrow(ForbiddenException);
  });

  it('422 when apiEnabled=false', async () => {
    usersRepo.users.push({ id: 'u2', tenantId, apiEnabled: false });
    await expect(ctl.create(makeReq('tenant_owner', tenantId) as any, 'u2', { scopes: [] })).rejects.toThrow(UnprocessableEntityException);
  });

  it('create/list/patch/delete ok & tenant isolation', async () => {
    usersRepo.users.push({ id: 'u3', tenantId, apiEnabled: true });
    const created = await ctl.create(makeReq('tenant_owner', tenantId) as any, 'u3', { scopes: ['ping'] });
    expect(created.token).toBeDefined();
    const list = await ctl.list(makeReq('tenant_owner', tenantId) as any, 'u3');
    expect(list.length).toBe(1);
    const tokId = service.tokens[0].id;
    const patched = await ctl.patch(makeReq('tenant_owner', tenantId) as any, tokId, { isActive: false });
    expect(patched.isActive).toBe(false);
    await expect(ctl.patch(makeReq('tenant_owner', otherTenant) as any, tokId, { isActive: true })).rejects.toThrow(NotFoundException);
    const del = await ctl.del(makeReq('tenant_owner', tenantId) as any, tokId);
    expect(del.deleted).toBe(true);
    await expect(ctl.del(makeReq('tenant_owner', tenantId) as any, tokId)).rejects.toThrow(NotFoundException);
  });
});
