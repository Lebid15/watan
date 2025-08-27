import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import jwt from 'jsonwebtoken';
import { jwtConstants } from '../src/auth/constants';

// This test now provisions a tenant + admin user context explicitly since product routes require tenant context.
function adminToken(tenantId: string) {
  return jwt.sign({ sub: 'admin-user-id', role: 'admin', email: 'admin@example.com', tenantId }, jwtConstants.secret, { expiresIn: '10m' });
}

describe('Admin Product Image (e2e)', () => {
  let app: INestApplication;
  let createdProductId: string | null = null;
  let tenantId: string;
  let ds: DataSource;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
  const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  ds = app.get<DataSource>(DataSource);
  });

  afterAll(async () => { if (app) await app.close(); });

  it('provisions tenant + product', async () => {
    // Seed tenant + product directly (avoids hitting /products POST which lacks JwtAuthGuard so guard expects user but none set).
    tenantId = '11111111-1111-1111-1111-111111111111';
  await ds.query(`INSERT INTO tenants (id, name, code, "ownerUserId", "isActive", createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`, [tenantId, 'Test Tenant', 'testcode', null, 1, new Date().toISOString(), new Date().toISOString()]);
    await ds.query(`INSERT INTO tenant_domain (id, tenantId, domain, type, isPrimary, isVerified, createdAt, updatedAt) VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))`, ['dom-1', tenantId, '127.0.0.1', 'subdomain', 1, 1]);
    createdProductId = '22222222-2222-2222-2222-222222222222';
    await ds.query(`INSERT INTO product (id, tenantId, name, description, catalogImageUrl, customImageUrl, useCatalogImage, isActive) VALUES (?,?,?,?,?,?,?,?)`, [
      createdProductId,
      tenantId,
      'Test Product',
      '',
      null,
      null,
      1, // useCatalogImage true
      1, // isActive
    ]);
    // sanity: ensure row exists
    const rows = await ds.query('SELECT id FROM product WHERE id=?', [createdProductId]);
    expect(rows.length).toBe(1);
  });

  it('rejects admin image mutation without auth', async () => {
    // If product wasn't created skip (previous failure)
    if (!createdProductId) return;
    await request(app.getHttpServer())
      .put(`/api/admin/products/${createdProductId}/image/custom`)
      .send({ customImageUrl: 'https://x/test.png' })
      .expect(401);
  });

  it('sets custom image (admin)', async () => {
    const token = adminToken(tenantId);
    if (!createdProductId) return; // safety
    const res = await request(app.getHttpServer())
  .put(`/api/admin/products/${createdProductId}/image/custom`)
  .set('Authorization', `Bearer ${token}`)
  .set('X-Tenant-Id', tenantId)
      .set('X-Tenant-Host', '127.0.0.1')
  .send({ customImageUrl: 'https://cdn.example.com/custom1.png' })
      .expect(res => { if (![200,201].includes(res.status)) throw new Error('Unexpected status '+res.status); });
    expect(res.body).toEqual(expect.objectContaining({
      ok: true,
      customImageUrl: 'https://cdn.example.com/custom1.png',
      useCatalogImage: false,
    }));
  });

  it('toggles back to catalog image', async () => {
    const token = adminToken(tenantId);
    if (!createdProductId) return; // safety
    const res = await request(app.getHttpServer())
  .put(`/api/admin/products/${createdProductId}/image/catalog`)
  .set('Authorization', `Bearer ${token}`)
  .set('X-Tenant-Id', tenantId)
      .set('X-Tenant-Host', '127.0.0.1')
  .send({ useCatalogImage: true })
      .expect(res => { if (![200,201].includes(res.status)) throw new Error('Unexpected status '+res.status); });
    expect(res.body).toEqual(expect.objectContaining({ ok: true, useCatalogImage: true }));
  });

  it('clears custom image', async () => {
    const token = adminToken(tenantId);
    if (!createdProductId) return; // safety
    const res = await request(app.getHttpServer())
  .delete(`/api/admin/products/${createdProductId}/image/custom`)
  .set('Authorization', `Bearer ${token}`)
  .set('X-Tenant-Id', tenantId)
      .set('X-Tenant-Host', '127.0.0.1')
      .expect(res => { if (![200,201].includes(res.status)) throw new Error('Unexpected status '+res.status); });
    expect(res.body).toEqual(expect.objectContaining({ ok: true, customImageUrl: null, useCatalogImage: true }));
  });
});
