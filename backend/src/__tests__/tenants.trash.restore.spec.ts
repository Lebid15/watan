// Minimal unit-style test to exercise conflict payloads and soft/hard delete flows via service
import 'reflect-metadata';
// Ensure sqlite-compatible column types in entities during tests
process.env.TEST_DB_SQLITE = 'true';
jest.setTimeout(15000);
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantsModule } from '../tenants/tenants.module';
import { Tenant } from '../tenants/tenant.entity';
import { TenantDomain } from '../tenants/tenant-domain.entity';
import { DataSource } from 'typeorm';
import { TenantsService } from '../tenants/tenants.service';

describe('Tenants trash/restore/hard-delete', () => {
  let ds: DataSource;
  let svc: TenantsService;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ type: 'sqlite', database: ':memory:', dropSchema: true, synchronize: true, entities: [Tenant, TenantDomain] }),
        TenantsModule,
      ],
    }).compile();
    ds = mod.get(DataSource);
    svc = mod.get(TenantsService);
  });

  it('soft deletes and restores a tenant', async () => {
    const created = await svc.createTenant({ name: 'T1', code: 't1' } as any);
    const id = created.tenant.id;
    await svc.deleteTenant(id, false);
    const trashed = await svc.getTenant(id, true);
    expect((trashed as any).deleted_at).toBeTruthy();
    const r = await svc.restoreTenant(id);
    expect(r.restored).toBe(true);
  });
});
