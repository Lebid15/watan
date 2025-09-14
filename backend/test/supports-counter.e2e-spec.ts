import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import request from 'supertest';
import { DataSource } from 'typeorm';
import jwt from 'jsonwebtoken';
import { jwtConstants } from '../src/auth/constants';

function adminToken(tenantId: string) {
  return jwt.sign({ sub: 'admin-user-counter', role: 'admin', email: 'admin@example.com', tenantId, totpVerified: true }, jwtConstants.secret, { expiresIn: '5m' });
}

describe('Supports Counter Toggle (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const tenantId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
  const productId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    ds = app.get<DataSource>(DataSource);

    // Seed tenant + product (supportsCounter initially false / null)
    await ds.query(`INSERT INTO tenant (id, name, code, "ownerUserId", "isActive", createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`, [tenantId, 'Counter Tenant', 'countercode', null, 1, new Date().toISOString(), new Date().toISOString()]);
    await ds.query(`INSERT INTO tenant_domain (id, tenantId, domain, type, isPrimary, isVerified, createdAt, updatedAt) VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))`, ['td-2', tenantId, '127.0.0.2', 'subdomain', 1, 1]);
    await ds.query(`INSERT INTO product (id, tenantId, name, description, isActive, supportsCounter) VALUES (?,?,?,?,?,?)`, [
      productId,
      tenantId,
      'Counter Product',
      '',
      1,
      0,
    ]);
  });

  afterAll(async () => { if (app) { try { if (ds?.isInitialized) await ds.destroy(); } catch {} await app.close(); } });

  it('PATCH enables supportsCounter then GET reflects it', async () => {
    const token = adminToken(tenantId);
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/products/${productId}/supports-counter`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .set('X-Tenant-Host', '127.0.0.2')
      .send({ supportsCounter: true });
    expect([200,201]).toContain(patchRes.status);
    expect(patchRes.body).toHaveProperty('supportsCounter', true);

    const getRes = await request(app.getHttpServer())
      .get(`/api/products/${productId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .set('X-Tenant-Host', '127.0.0.2');
    expect(getRes.status).toBe(200);
    expect(getRes.body).toHaveProperty('supportsCounter', true);
  });

  it('PATCH accepts string truthy variant', async () => {
    const token = adminToken(tenantId);
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/products/${productId}/supports-counter`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .set('X-Tenant-Host', '127.0.0.2')
      .send({ supportsCounter: 'off' });
    expect([200,201]).toContain(patchRes.status);
    expect(patchRes.body).toHaveProperty('supportsCounter', false);
  });
});
