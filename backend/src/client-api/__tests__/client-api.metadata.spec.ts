// Ensure sqlite-compatible entity column types before any entity imports
process.env.TEST_DB_SQLITE = 'true';
process.env.PASSKEYS_FORCE_ENABLED = 'false';
process.env.PRICE_DECIMALS = process.env.PRICE_DECIMALS || '2';
process.env.TEST_DISABLE_SCHEDULERS = 'true';
process.env.TEST_SYNC_CLIENT_API_LOGS = '1';
process.env.TEST_DISABLE_RATE_LIMIT = 'true';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Product } from '../../products/product.entity';
import { ProductPackage } from '../../products/product-package.entity';
import { User } from '../../user/user.entity';
import { ProductApiMetadata } from '../../products/product-api-metadata.entity';
import { Tenant } from '../../tenants/tenant.entity';
import { flushClientApiLogs } from '../../client-api/client-api-logging.interceptor';

// Helper: extract error {code,message}
function expectError(res: request.Response, code: number) {
  expect(res.status).toBe(200);
  expect(res.body).toHaveProperty('code', code);
  expect(typeof res.body.message).toBe('string');
}

describe('Client API Metadata & Validation (e2e-lite)', () => {
  jest.setTimeout(20000);
  let app: INestApplication;
  let ds: DataSource;
  let user: User;
  let token: string;
  let tenantId: string;
  let fixedPkg: ProductPackage; // null/fixed
  let rangePkg: ProductPackage;
  let listPkg: ProductPackage;
  let nullPkg: ProductPackage;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    ds = app.get(DataSource);

    // Seed tenant/user (simplified: assume user has tenantId column and balance etc.)
    // Create tenant first for FK integrity
    const tenantRepo = ds.getRepository(Tenant);
    const tenant = tenantRepo.create({ name: 'ApiTenant', code: 'apit', isActive: true } as any);
    await tenantRepo.save(tenant as any);
  user = ds.getRepository(User).create({ username: 'apiuser', email: 'u@example.com', password: 'x', tenantId: (tenant as any).id, apiEnabled: true, apiToken: 'abcdefabcdefabcdefabcdefabcdefabcdefabcd', balance: 1000, overdraftLimit: 100000 });
    await ds.getRepository(User).save(user);
    tenantId = (tenant as any).id;

    // Seed products & packages
    async function makeProduct(name: string) {
      const p = ds.getRepository(Product).create({ name, tenantId, isActive: true });
      await ds.getRepository(Product).save(p);
      const pkg = ds.getRepository(ProductPackage).create({ tenantId, product: p, basePrice: 10, capital: 0, isActive: true, name: name+ '-pkg', publicCode: null });
      await ds.getRepository(ProductPackage).save(pkg);
      return { product: p, pkg };
    }

    const fixed = await makeProduct('fixed');
    fixedPkg = fixed.pkg;
    const range = await makeProduct('range');
    rangePkg = range.pkg;
    const list = await makeProduct('list');
    listPkg = list.pkg;
    const nul = await makeProduct('nul');
    nullPkg = nul.pkg;

    // Metadata
    await ds.getRepository(ProductApiMetadata).save({ productId: fixed.product.id, qtyMode: 'fixed', qtyFixed: 1, paramsSchema: [{ key: 'playerId', required: true, pattern: '^[0-9]+$' }] });
    await ds.getRepository(ProductApiMetadata).save({ productId: range.product.id, qtyMode: 'range', qtyMin: 5, qtyMax: 10, qtyFixed: 1, paramsSchema: [] });
    await ds.getRepository(ProductApiMetadata).save({ productId: list.product.id, qtyMode: 'list', qtyList: ['10','20','30'], qtyFixed: 1, paramsSchema: [{ key: 'mode', required: false, enum: ['A','B'] }] });
    // null product uses defaults (no metadata)
  });

  afterAll(async () => {
    await flushClientApiLogs().catch(()=>{});
    try { await app?.close(); } catch {}
    try { await ds?.destroy(); } catch {}
  });

  function auth(req: request.Test) { return req.set('x-api-token', user.apiToken!); }

  it('products base list minimal fields', async () => {
    const res = await auth(request(app.getHttpServer()).get('/client/api/products?base=1'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    for (const item of res.body) {
      expect(Object.keys(item).sort()).toEqual(['id','name']);
    }
  });

  it('products full list includes qty_values and params', async () => {
    const res = await auth(request(app.getHttpServer()).get('/client/api/products'));
    expect(res.status).toBe(200);
    const fixed = res.body.find((x: any) => x.name === 'fixed');
    const range = res.body.find((x: any) => x.name === 'range');
    const list = res.body.find((x: any) => x.name === 'list');
    const nul = res.body.find((x: any) => x.name === 'nul');
    expect(fixed.qty_values).toBeNull();
    expect(range.qty_values).toEqual({ min: 5, max: 10 });
    expect(list.qty_values).toEqual(['10','20','30']);
    expect(nul.qty_values).toBeNull();
    expect(fixed.params).toContain('playerId');
    expect(list.params).toContain('mode');
  });

  it('fixed qty must be 1, else 106', async () => {
    const resOk = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${fixedPkg.id}/params`).query({ qty: '1', playerId: '123' }));
    expect(resOk.body).not.toHaveProperty('code');
    const resErr = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${fixedPkg.id}/params`).query({ qty: '2', playerId: '123' }));
    expectError(resErr, 106);
  });

  it('range qty edges ok; below min 112; above max 113', async () => {
    const below = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${rangePkg.id}/params`).query({ qty: '4' }));
    expectError(below, 112);
    const above = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${rangePkg.id}/params`).query({ qty: '11' }));
    expectError(above, 113);
    const edgeMin = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${rangePkg.id}/params`).query({ qty: '5' }));
    expect(edgeMin.body).not.toHaveProperty('code');
    const edgeMax = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${rangePkg.id}/params`).query({ qty: '10' }));
    expect(edgeMax.body).not.toHaveProperty('code');
  });

  it('list qty must be one of list else 106', async () => {
    const ok = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${listPkg.id}/params`).query({ qty: '10' }));
    expect(ok.body).not.toHaveProperty('code');
    const bad = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${listPkg.id}/params`).query({ qty: '999' }));
    expectError(bad, 106);
  });

  it('missing required param => 114', async () => {
    const res = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${fixedPkg.id}/params`).query({ qty: '1' }));
    expectError(res, 114);
    expect(res.body.message).toMatch(/Missing param: playerId/);
  });

  it('invalid param pattern => 114', async () => {
    const res = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${fixedPkg.id}/params`).query({ qty: '1', playerId: 'abc' }));
    expectError(res, 114);
    expect(res.body.message).toMatch(/Invalid param: playerId/);
  });

  it('enum validation => 114 when not in enum', async () => {
    const res = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${listPkg.id}/params`).query({ qty: '10', mode: 'Z' }));
    expectError(res, 114);
  });

  it('idempotent order creation with order_uuid', async () => {
    const order_uuid = uuidv4();
    const first = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${fixedPkg.id}/params`).query({ qty: '1', order_uuid, playerId: '123' }));
    const second = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${fixedPkg.id}/params`).query({ qty: '1', order_uuid, playerId: '123' }));
    expect(first.body.id).toBeDefined();
    expect(second.body.id).toBe(first.body.id);
  });

  it('check by id & uuid', async () => {
    const order_uuid = uuidv4();
    const created = await auth(request(app.getHttpServer()).post(`/client/api/newOrder/${fixedPkg.id}/params`).query({ qty: '1', order_uuid, playerId: '999' }));
    const idCheck = await auth(request(app.getHttpServer()).get(`/client/api/check`).query({ orders: created.body.id }));
    expect(Array.isArray(idCheck.body)).toBe(true);
    const uuidCheck = await auth(request(app.getHttpServer()).get(`/client/api/check`).query({ orders: order_uuid, uuid: '1' }));
    expect(uuidCheck.body[0].order_uuid).toBe(order_uuid);
  });
});
