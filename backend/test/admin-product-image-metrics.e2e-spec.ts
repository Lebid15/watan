import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import jwt from 'jsonwebtoken';
import { jwtConstants } from '../src/auth/constants';

// This test assumes access without auth only if guards allow (may need token in real env). Kept simple.
describe('Admin Product Image Metrics (e2e)', () => {
  let app: INestApplication;
  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });
  afterAll(async () => {
  if (app) await app.close();
  });

  function devToken() { return jwt.sign({ sub: 'dev-user-id', role: 'developer', email: 'dev@example.com' }, jwtConstants.secret, { expiresIn: '5m' }); }

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
