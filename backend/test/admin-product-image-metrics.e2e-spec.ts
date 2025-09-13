import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import jwt from 'jsonwebtoken';
import { jwtConstants } from '../src/auth/constants';
import { DataSource } from 'typeorm';

// This test assumes access without auth only if guards allow (may need token in real env). Kept simple.
describe('Admin Product Image Metrics (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    // Seed a developer user so JWT auth passes (JwtStrategy validates user exists).
    ds = app.get(DataSource);
    const devTenantId = 'dev-metrics-tenant-000000000000';
    await ds.query(`INSERT INTO tenant (id, name, code, "ownerUserId", "isActive", createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`, [devTenantId, 'Dev Metrics Tenant', 'devmetrics', null, 1, new Date().toISOString(), new Date().toISOString()]);
    await ds.query(`INSERT INTO tenant_domain (id, tenantId, domain, type, isPrimary, isVerified, createdAt, updatedAt) VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))`, ['td-metrics-1', devTenantId, '127.0.0.1', 'subdomain', 1, 1]);
    // Minimal developer user row (associate with null tenant since developer may be global)
    await ds.query(`INSERT INTO users (id, role, email, password, isActive, username) VALUES (?,?,?,?,?,?)`, ['dev-user-id', 'developer', 'dev@example.com', 'x', 1, 'dev']);
  });
  afterAll(async () => {
    try { if (ds?.isInitialized) await ds.destroy(); } catch {}
    if (app) await app.close();
  });

  function devToken() { return jwt.sign({ sub: 'dev-user-id', role: 'developer', email: 'dev@example.com', totpVerified: true }, jwtConstants.secret, { expiresIn: '5m' }); }

  it('GET /api/admin/products/image-metrics/latest (auth)', async () => {
    const token = devToken();
    const res = await request(app.getHttpServer())
      .get('/api/admin/products/image-metrics/latest?limit=5')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(Array.isArray(res.body.rows)).toBe(true);
  });

  it('GET /api/admin/products/image-metrics/delta (auth)', async () => {
    const token = devToken();
    const res = await request(app.getHttpServer())
      .get('/api/admin/products/image-metrics/delta')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toHaveProperty('ok', true);
    // delta may be null if insufficient history
    if (res.body.delta) {
      expect(res.body.delta).toEqual(expect.objectContaining({
        customDiff: expect.any(Number),
        catalogDiff: expect.any(Number),
        missingDiff: expect.any(Number),
      }));
    }
  });
});
