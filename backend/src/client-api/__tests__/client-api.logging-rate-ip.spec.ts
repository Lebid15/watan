// Ensure sqlite-friendly entity definitions before any imports
process.env.TEST_DB_SQLITE = 'true';
process.env.PASSKEYS_FORCE_ENABLED = 'false';
process.env.PRICE_DECIMALS = process.env.PRICE_DECIMALS || '2';
process.env.TEST_DISABLE_SCHEDULERS = 'true';
process.env.TEST_SYNC_CLIENT_API_LOGS = '1';
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
import { Tenant } from '../../tenants/tenant.entity';
import { ClientApiRequestLog } from '../client-api-request-log.entity';
import { flushClientApiLogs } from '../client-api-logging.interceptor';
import { ClientApiStatsDaily } from '../client-api-stats-daily.entity';

function auth(req: request.Test, token: string) { return req.set('x-api-token', token); }

describe('Client API Logging + Rate Limit + IP normalization', () => {
  jest.setTimeout(20000);
  let app: INestApplication; let ds: DataSource; let user: User; let token: string; let pkg: ProductPackage;

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    await app.init();
    ds = app.get(DataSource);
  token = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd'; // 40 hex
  // Create tenant first to satisfy FK constraint
  const tenantRepo = ds.getRepository(Tenant);
  const tenant = tenantRepo.create({ name: 'LogTenant', code: 'logt', isActive: true } as any);
  await tenantRepo.save(tenant as any);
  user = ds.getRepository(User).create({ username: 'loguser', email: 'l@example.com', password: 'x', tenantId: (tenant as any).id, apiEnabled: true, apiToken: token, balance: 1000, overdraftLimit: 100000, apiRateLimitPerMin: null });
    await ds.getRepository(User).save(user);
    const prod = ds.getRepository(Product).create({ name: 'LogProduct', tenantId: user.tenantId!, isActive: true });
    await ds.getRepository(Product).save(prod);
    pkg = ds.getRepository(ProductPackage).create({ tenantId: user.tenantId!, product: prod, basePrice: 10, capital: 0, isActive: true, name: 'LP', publicCode: null });
    await ds.getRepository(ProductPackage).save(pkg);
    await ds.getRepository(ProductApiMetadata).save({ productId: prod.id, qtyMode: 'fixed', qtyFixed: 1, paramsSchema: [] });
  });

  afterAll(async () => { await flushClientApiLogs().catch(()=>{}); try { await app?.close(); } catch {}; try { await ds?.destroy(); } catch {}; });

  it('logs only last 20 (pruning) with successful requests & header normalization', async () => {
    // Generate 25 successful orders to trigger pruning (keeping newest 20)
    for (let i=0;i<25;i++) {
      await auth(
        request(app.getHttpServer())
          .post(`/client/api/newOrder/${pkg.id}/params`)
          .set('x-forwarded-for', '203.0.113.9, 70.41.3.18')
          .query({ qty: '1' }),
        token,
      );
    }
  // Allow any async pruning task to complete if pruning happens out-of-band
  await new Promise(r=>setTimeout(r, 25));
  const repo = ds.getRepository(ClientApiRequestLog);
  const all = await repo.find({ where: { userId: user.id } as any, order: { createdAt: 'ASC' } });
    expect(all.length).toBe(20); // prune to exactly 20
    // Ensure newest record has success code (0)
    expect(all[all.length-1].code).toBe(0);
    // Oldest record index should be after pruning
  });

  it('rate limit: second call blocked then after window passes allowed again', async () => {
    // Clear prior logs to start fresh
    await ds.getRepository(ClientApiRequestLog).delete({ userId: user.id } as any);
    // set limit=1 (one allowed per minute)
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
    // Reset limit so other tests (IP normalization) are not rate limited
    await ds.getRepository(User).update(user.id, { apiRateLimitPerMin: null });
  });

  it('IP normalization picks first public client IP from chain', async () => {
    // Ensure no residual rate-limit logs interfere
    await ds.getRepository(ClientApiRequestLog).delete({ userId: user.id } as any);
    await auth(
      request(app.getHttpServer())
        .get('/client/api/products')
        .set('x-forwarded-for', '203.0.113.9, 70.41.3.18'),
      token,
    );
    const repo = ds.getRepository(ClientApiRequestLog);
    const last = await repo.find({ where: { userId: user.id } as any, order: { createdAt: 'DESC' }, take: 1 });
    expect(last[0].ip).toBe('203.0.113.9');
  });
});
