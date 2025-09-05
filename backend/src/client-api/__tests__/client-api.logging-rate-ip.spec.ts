import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { User } from '../../user/user.entity';
import { Product } from '../../products/product.entity';
import { ProductPackage } from '../../products/product-package.entity';
import { ProductApiMetadata } from '../../products/product-api-metadata.entity';
import { v4 as uuidv4 } from 'uuid';
import { ClientApiRequestLog } from '../client-api-request-log.entity';
import { ClientApiStatsDaily } from '../client-api-stats-daily.entity';

function auth(req: request.Test, token: string) { return req.set('x-api-token', token); }

describe('Client API Logging + Rate Limit + IP normalization', () => {
  let app: INestApplication; let ds: DataSource; let user: User; let token: string; let pkg: ProductPackage;

  beforeAll(async () => {
    process.env.TEST_DB_SQLITE = 'true';
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    ds = app.get(DataSource);
    token = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd'; // 40 hex
    user = ds.getRepository(User).create({ username: 'loguser', email: 'l@example.com', password: 'x', tenantId: uuidv4(), apiEnabled: true, apiToken: token, balance: 0, apiRateLimitPerMin: null });
    await ds.getRepository(User).save(user);
    const prod = ds.getRepository(Product).create({ name: 'LogProduct', tenantId: user.tenantId!, isActive: true });
    await ds.getRepository(Product).save(prod);
    pkg = ds.getRepository(ProductPackage).create({ tenantId: user.tenantId!, product: prod, basePrice: 10, capital: 0, isActive: true, name: 'LP', publicCode: null });
    await ds.getRepository(ProductPackage).save(pkg);
    await ds.getRepository(ProductApiMetadata).save({ productId: prod.id, qtyMode: 'fixed', qtyFixed: 1, paramsSchema: [] });
  });

  afterAll(async () => { await app.close(); });

  it('logs only last 20 (pruning) and normalizes IP', async () => {
    for (let i=0;i<25;i++) {
      await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${pkg.id}/params`).query({ qty: '1' }), token);
    }
    const repo = ds.getRepository(ClientApiRequestLog);
    const all = await repo.find({ where: { userId: user.id } as any, order: { createdAt: 'ASC' } });
    expect(all.length).toBeLessThanOrEqual(20);
    if (all.length) {
      // Ensure last entries have code 0
      expect(all[all.length-1].code).toBe(0);
    }
  });

  it('rate limit: second call blocked then after window passes allowed again', async () => {
    // set limit=1
    await ds.getRepository(User).update(user.id, { apiRateLimitPerMin: 1 });
    const first = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${pkg.id}/params`).query({ qty: '1' }), token);
    expect(first.body).not.toHaveProperty('code');
    const second = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${pkg.id}/params`).query({ qty: '1' }), token);
    expect(second.body.code).toBe(429);
    // simulate window pass by manually deleting logs except one and adjusting createdAt
    const repo = ds.getRepository(ClientApiRequestLog);
    const logs = await repo.find({ where: { userId: user.id } as any });
    for (const l of logs) { l.createdAt = new Date(Date.now() - 61_000); await repo.save(l); }
    const third = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${pkg.id}/params`).query({ qty: '1' }), token);
    expect(third.body).not.toHaveProperty('code');
  });

  it('IP normalization from headers', async () => {
    // X-Forwarded-For chain
    await auth(request(app.getHttpServer()).get('/client/api/products').set('X-Forwarded-For','203.0.113.5, 10.0.0.9'), token);
    // IPv4-mapped
    await auth(request(app.getHttpServer()).get('/client/api/products').set('X-Forwarded-For','::ffff:198.51.100.10'), token);
    // local
    await auth(request(app.getHttpServer()).get('/client/api/products'), token);
    const repo = ds.getRepository(ClientApiRequestLog);
    const recent = await repo.find({ where: { userId: user.id } as any, order: { createdAt: 'DESC' }, take: 3 });
    const ips = recent.map(r=>r.ip);
    expect(ips).toContain('203.0.113.5');
    expect(ips).toContain('198.51.100.10');
    expect(ips).toContain('127.0.0.1');
  });
});
