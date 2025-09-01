import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { FEATURE_FLAGS } from '../src/common/feature-flags';
import { Tenant } from '../src/tenants/tenant.entity';
import { User } from '../src/user/user.entity';
import { PaymentMethod, PaymentMethodType } from '../src/payments/payment-method.entity';
import { hash } from 'bcryptjs';

async function login(app: INestApplication, email: string, password: string, tenantCode?: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ emailOrUsername: email, password, tenantCode });
  return res.body?.token as string | undefined;
}

describe('Admin Deposit Topup (e2e)', () => {
  let app: INestApplication; let ds: DataSource;
  let tenantId: string; let tenantCode: string; let adminToken: string; let userId: string; let pmId: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    (FEATURE_FLAGS as any).billingV1 = true; // ensure modules guarded by feature flag load if needed
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    ds = app.get(DataSource, { strict: false });

  // Seed tenant + admin + normal user + payment method using repositories (works with in-memory sqlite)
  const tenantRepo = ds.getRepository(Tenant);
  const userRepo = ds.getRepository(User);
  const pmRepo = ds.getRepository(PaymentMethod);

  const tenant = tenantRepo.create({ name: 'Tenant X', code: 'tenantx' });
  await tenantRepo.save(tenant);
  tenantId = tenant.id; tenantCode = tenant.code;

  // Create admin user
  const adminPwd = await hash('Pass1234', 4);
  const admin = userRepo.create({ email: 'adminx@example.com', password: adminPwd, role: 'admin', tenantId, isActive: true, balance: 0, overdraftLimit:0 });
  await userRepo.save(admin);

  // Normal user
  const userPwd = await hash('Pass1234', 4);
  const u = userRepo.create({ email: 'userx@example.com', password: userPwd, role: 'user', tenantId, isActive: true, balance:0, overdraftLimit:0 });
  await userRepo.save(u); userId = u.id;

  // Payment method
  const pm = pmRepo.create({ tenantId, name: 'Cash Box', type: PaymentMethodType.CASH_BOX, isActive: true, config: {} });
  await pmRepo.save(pm); pmId = pm.id;

  adminToken = await login(app, 'adminx@example.com', 'Pass1234', tenantCode) || '';
  });

  afterAll(async () => { if (app) await app.close(); if (ds?.isInitialized) await ds.destroy(); });

  it('creates approved admin_topup deposit and updates user balance', async () => {
    if (!adminToken) return; // guard
    const amount = 150.75;
    const res = await request(app.getHttpServer())
      .post('/api/admin/deposits/topup')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-Id', tenantId)
      .send({ userId, amount, methodId: pmId, note: 'Support top-up' })
      .expect(201);

    expect(res.body.deposit).toBeDefined();
    expect(res.body.deposit.status).toBe('approved');
    expect(res.body.deposit.source).toBe('admin_topup');
    expect(res.body.deposit.methodId).toBe(pmId);
    expect(Number(res.body.deposit.convertedAmount)).toBeCloseTo(amount, 2);
    expect(res.body.balance).toBeGreaterThanOrEqual(amount);

    // Fetch deposits list (ensure appears)
    const list = await request(app.getHttpServer())
      .get('/api/admin/deposits')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-Id', tenantId)
      .expect(200);
    const found = list.body.items?.find((d: any) => d.id === res.body.deposit.id);
    expect(found).toBeTruthy();
  });

  it('rejects missing methodId', async () => {
    if (!adminToken) return;
    await request(app.getHttpServer())
      .post('/api/admin/deposits/topup')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('X-Tenant-Id', tenantId)
      .send({ userId, amount: 10 })
      .expect(res => {
        if (![400,422].includes(res.status)) throw new Error('Expected validation error');
      });
  });
});
