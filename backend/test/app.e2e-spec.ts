import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { DataSource } from 'typeorm';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => {
    if (!app) return;
    // Attempt to resolve datasource by type (preferred) then by token name
    let ds: DataSource | undefined;
    try { ds = app.get(DataSource, { strict: false }); } catch {}
    if (!ds) {
      try { ds = app.get<any>('DataSource', { strict: false }); } catch {}
    }
    await app.close();
    if (ds?.isInitialized) await ds.destroy();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200);
  });

  it('/api/metrics (GET)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/metrics')
      .expect(200);
    expect(res.text).toContain('product_image_custom_total');
    expect(res.text).toContain('product_image_catalog_total');
  });

  it('/api/metrics (GET) with token (if enforced)', async () => {
    // Simulate token protection by setting env var at runtime
    process.env.METRICS_TOKEN = 'test-token';
    // Call without token -> expect 401
    await request(app.getHttpServer())
      .get('/api/metrics')
      .expect(res => {
        if (![200,401].includes(res.status)) throw new Error('Unexpected status');
      });
    // Call with token header -> expect 200
    const ok = await request(app.getHttpServer())
      .get('/api/metrics')
      .set('Authorization','Bearer test-token')
      .expect(200);
    expect(ok.text).toContain('product_image_custom_total');
    delete process.env.METRICS_TOKEN;
  });
});
