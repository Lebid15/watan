import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Tenant } from '../src/tenants/tenant.entity';
import { Product } from '../src/products/product.entity';

// NOTE: This is a lightweight smoke test for the product image fallback fields.
// It does NOT cover auth flow; assumes a seeded tenant & product if fixtures exist.
// If no product exists the test will create one (anonymous create may fail if guards applied differently in real env).

describe('Product Image Fallback (e2e)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let tenant: Tenant;
  let product: Product | undefined;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    // Resolve DataSource (by type preferred)
    try { ds = app.get(DataSource, { strict: false }); } catch { /* ignore */ }
    if (!ds) {
      try { ds = app.get<any>('DataSource', { strict: false }); } catch { /* ignore */ }
    }
    // Seed a tenant + one product so listing works with explicit tenant header
    if (ds) {
      const tenantRepo = ds.getRepository(Tenant);
      tenant = await tenantRepo.save({ name: 'Image Fallback Test Tenant', code: 'imgfb-' + Date.now().toString(36) });
      const productRepo = ds.getRepository(Product);
      product = await productRepo.save({
        name: 'Test Product',
        description: 'Seeded for image fallback e2e',
        tenantId: tenant.id,
        isActive: true,
        useCatalogImage: true,
      } as any);
    }
  });

  afterAll(async () => {
    if (!app) return;
    await app.close();
    if (ds?.isInitialized) await ds.destroy();
  });

  it('exposes image fallback fields on /api/products list', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/products')
      .set('x-tenant-id', tenant.id)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body[0]) {
      const p = res.body[0];
      // Presence checks (values may be null)
      expect(p).toHaveProperty('imageUrl');
      expect(p).toHaveProperty('imageSource');
      expect(p).toHaveProperty('useCatalogImage');
      expect(p).toHaveProperty('hasCustomImage');
      expect(p).toHaveProperty('customImageUrl');
      expect(typeof p.useCatalogImage).toBe('boolean');
      expect(typeof p.hasCustomImage).toBe('boolean');
    }
    // If at least one product exists, test the detail endpoint for same fields
    if (res.body[0]?.id) {
      const detail = await request(app.getHttpServer())
        .get(`/api/products/${res.body[0].id}`)
        .set('x-tenant-id', tenant.id)
        .expect(200);
  const d = detail.body;
  expect(d.id).toBe(res.body[0].id);
  expect(d).toHaveProperty('imageUrl');
  expect(d).toHaveProperty('imageSource');
  expect(d).toHaveProperty('useCatalogImage');
  expect(d).toHaveProperty('hasCustomImage');
  expect(d).toHaveProperty('customImageUrl');
  expect(typeof d.useCatalogImage).toBe('boolean');
  expect(typeof d.hasCustomImage).toBe('boolean');
    }
  });
});
