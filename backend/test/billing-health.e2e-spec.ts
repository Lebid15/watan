import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { FEATURE_FLAGS } from '../src/common/feature-flags';
import { User } from '../src/user/user.entity';
import * as bcrypt from 'bcryptjs';

function auth(token: string) { return { Authorization: `Bearer ${token}` }; }

describe('Billing Health (e2e)', () => {
  let app: INestApplication; let ds: DataSource; let adminToken: string;
  beforeAll(async () => {
    (FEATURE_FLAGS as any).billingV1 = true;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    ds = app.get(DataSource, { strict: false });
    // Seed instance_owner user
    const repo = ds.getRepository(User);
    const password = await bcrypt.hash('Pass1234', 4);
    const u = repo.create({ email: 'ops-admin@example.com', password, role: 'instance_owner', isActive: true, balance:0, overdraftLimit:0 });
    await repo.save(u);
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ emailOrUsername: 'ops-admin@example.com', password: 'Pass1234' });
    adminToken = login.body.token;
  });
  afterAll(async () => { if (app) await app.close(); if (ds?.isInitialized) await ds.destroy(); });

  it('GET /api/admin/billing/health returns fields', async () => {
    const res = await request(app.getHttpServer()).get('/api/admin/billing/health').set(auth(adminToken)).expect(200);
    expect(res.body).toHaveProperty('openInvoices');
    expect(res.body).toHaveProperty('suspendedTenants');
    expect(res.body).toHaveProperty('lastIssueAt');
    expect(res.body).toHaveProperty('lastEnforceAt');
  });
});
