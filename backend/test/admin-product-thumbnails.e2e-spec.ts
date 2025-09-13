import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import jwt from 'jsonwebtoken';
import { jwtConstants } from '../src/auth/constants';

function adminToken(tenantId: string) {
  return jwt.sign({ sub: 'admin-user-thumb', role: 'admin', email: 'admin@example.com', tenantId, totpVerified: true }, jwtConstants.secret, { expiresIn: '10m' });
}

describe('Admin Product Thumbnails (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let tenantId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  let productId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    ds = app.get<DataSource>(DataSource);
    // seed tenant + product (with custom image to trigger thumbs)
    // Table is 'tenant' (singular)
    await ds.query(`INSERT INTO tenant (id, name, code, "ownerUserId", "isActive", createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)`, [tenantId, 'Thumb Tenant', 'thumbcode', null, 1, new Date().toISOString(), new Date().toISOString()]);
    await ds.query(`INSERT INTO tenant_domain (id, tenantId, domain, type, isPrimary, isVerified, createdAt, updatedAt) VALUES (?,?,?,?,?,?,datetime('now'),datetime('now'))`, ['td-1', tenantId, '127.0.0.1', 'subdomain', 1, 1]);
    await ds.query(`INSERT INTO product (id, tenantId, name, description, customImageUrl, isActive) VALUES (?,?,?,?,?,?)`, [
      productId,
      tenantId,
      'Thumb Product',
      '',
      null,
      1,
    ]);
  });

  afterAll(async () => { if (app) { try { if (ds?.isInitialized) await ds.destroy(); } catch {} await app.close(); } });

  it('sets a custom image and generates thumbnails (URLs echo)', async () => {
    const token = adminToken(tenantId);
    const imageUrl = 'https://res.cloudinary.com/demo/image/upload/v1/sample.jpg';
    const res = await request(app.getHttpServer())
      .put(`/api/admin/products/${productId}/image/custom`)
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .set('X-Tenant-Host', '127.0.0.1') // ensure middleware resolves tenant
      .send({ customImageUrl: imageUrl });
    expect([200,201]).toContain(res.status);
    // refetch raw product row to inspect thumbnail fields
    const rows = await ds.query('SELECT thumbSmallUrl, thumbMediumUrl, thumbLargeUrl FROM product WHERE id=?', [productId]);
    expect(rows.length).toBe(1);
    const r = rows[0];
    // For cloudinary transformation the small variant should contain w_64 or similar string
    expect(r.thumbSmallUrl).toContain('w_64');
    expect(r.thumbMediumUrl).toContain('w_200');
    expect(r.thumbLargeUrl).toContain('w_400');
  });

  it('manual regeneration endpoint works (no-op when already present)', async () => {
    const token = adminToken(tenantId);
    const res = await request(app.getHttpServer())
      .post('/api/admin/products/images/regenerate-thumbnails')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Tenant-Id', tenantId)
      .set('X-Tenant-Host', '127.0.0.1')
      .send({ ids: [productId] });
    expect([200,201]).toContain(res.status);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('processed');
  });
});
