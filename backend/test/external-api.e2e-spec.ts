import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { __rateLimitBuckets } from '../src/external-api/external-rate-limit.interceptor';

// NOTE: This is a trimmed E2E focusing on external API flow & error envelope.

describe('External API E2E', () => {
  let app: INestApplication;
  let ds: DataSource;
  let tokenFull: string;
  let externalUserId: string;
  let externalUserId2: string;
  let orderId: string;
<<<<<<< HEAD
  let publicCode: number;
=======
  let linkCode: string;
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
  let tokenId: string; // primary token id (db)
  let tokenFull2: string; // second user token

  beforeAll(async () => {
    process.env.TEST_DB_SQLITE = 'true';
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    ds = app.get(DataSource);

  // Seed tenant + users + product + package
    const tenantId = uuid();
  await ds.query(`INSERT INTO tenants(id, name, code, isActive) VALUES($1,'T','t1',1)`, [tenantId]);
    const ownerId = uuid();
    await ds.query(`INSERT INTO users(id, tenantId, email, password, role, balance, overdraftLimit, apiEnabled) VALUES($1,$2,'o@x','pw','tenant_owner',100,0,true)`, [ownerId, tenantId]);
  externalUserId = uuid();
  await ds.query(`INSERT INTO users(id, tenantId, email, password, role, balance, overdraftLimit, apiEnabled) VALUES($1,$2,'u@x','pw','user',50,0,true)`, [externalUserId, tenantId]);
  externalUserId2 = uuid();
  await ds.query(`INSERT INTO users(id, tenantId, email, password, role, balance, overdraftLimit, apiEnabled) VALUES($1,$2,'u2@x','pw','user',30,0,true)`, [externalUserId2, tenantId]);

    const productId = uuid();
  await ds.query(`INSERT INTO product(id, tenantId, name, isActive) VALUES($1,$2,'Prod',true)`, [productId, tenantId]);
    const packageId = uuid();
<<<<<<< HEAD
    publicCode = 101;
  await ds.query(`INSERT INTO product_packages(id, tenantId, product_id, name, basePrice, capital, isActive, publicCode) VALUES($1,$2,$3,'Pack',10,5,true,$4)`, [packageId, tenantId, productId, publicCode]);
=======
    linkCode = 'pkg_link_1';
  await ds.query(`INSERT INTO product_packages(id, tenantId, product_id, name, basePrice, capital, isActive, catalogLinkCode) VALUES($1,$2,$3,'Pack',10,5,true,$4)`, [packageId, tenantId, productId, linkCode]);
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))

    // Create token manually (bypassing controller) with scopes
  const prefix = 'pk1';
    const secret = 'secretsecretsecretsecret123456';
    const tokenHash = require('crypto').createHash('sha256').update(secret).digest('hex');
  tokenId = uuid();
<<<<<<< HEAD
  await ds.query(`INSERT INTO tenant_api_tokens(id, tenantId, userId, name, tokenPrefix, tokenHash, scopes, isActive, createdAt) VALUES($1,$2,$3,'ext',$4,$5,$6,true,datetime('now'))`, [tokenId, tenantId, externalUserId, prefix, tokenHash, JSON.stringify(['ping','wallet.balance','orders.create','orders.read'])]);
=======
  await ds.query(`INSERT INTO tenant_api_tokens(id, tenantId, userId, name, tokenPrefix, tokenHash, scopes, isActive, createdAt) VALUES($1,$2,$3,'ext',$4,$5,$6,true,datetime('now'))`, [tokenId, tenantId, externalUserId, prefix, tokenHash, JSON.stringify(['ping','wallet.balance','catalog.read','orders.create','orders.read'])]);
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
  tokenFull = `${prefix}.${secret}`;

  // Second token for cross-user forbidden test (read-only orders.read scope)
  const prefix2 = 'pk2';
  const secret2 = 'anothersecretsecretsecret123';
  const tokenHash2 = require('crypto').createHash('sha256').update(secret2).digest('hex');
  const tokenId2 = uuid();
<<<<<<< HEAD
  await ds.query(`INSERT INTO tenant_api_tokens(id, tenantId, userId, name, tokenPrefix, tokenHash, scopes, isActive, createdAt) VALUES($1,$2,$3,'ext2',$4,$5,$6,true,datetime('now'))`, [tokenId2, tenantId, externalUserId2, prefix2, tokenHash2, JSON.stringify(['ping','wallet.balance','orders.read'])]);
=======
  await ds.query(`INSERT INTO tenant_api_tokens(id, tenantId, userId, name, tokenPrefix, tokenHash, scopes, isActive, createdAt) VALUES($1,$2,$3,'ext2',$4,$5,$6,true,datetime('now'))`, [tokenId2, tenantId, externalUserId2, prefix2, tokenHash2, JSON.stringify(['ping','wallet.balance','catalog.read','orders.read'])]);
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
  tokenFull2 = `${prefix2}.${secret2}`;
  // (debug queries removed)
  });

  function expectEnvelope(obj: any, code: string, status?: number) {
    expect(obj).toHaveProperty('statusCode');
    expect(obj).toHaveProperty('code', code);
    expect(obj).toHaveProperty('message');
    expect(obj).toHaveProperty('timestamp');
    expect(obj).toHaveProperty('path');
    if (status) expect(obj.statusCode).toBe(status);
  }

<<<<<<< HEAD
  afterAll(async () => { if (app) { try { if (ds?.isInitialized) await ds.destroy(); } catch {} await app.close(); } });
=======
  afterAll(async () => { await app.close(); });
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))

  it('ping ok', async () => {
    const res = await request(app.getHttpServer()).get('/api/tenant/external/v1/ping').set('Authorization', 'Bearer ' + tokenFull).expect(200);
    expect(res.body.ok).toBe(true);
  });

  it('balance formatted', async () => {
    const res = await request(app.getHttpServer()).get('/api/tenant/external/v1/wallet/balance').set('Authorization', 'Bearer ' + tokenFull).expect(200);
    expect(res.body.balanceUSD3).toMatch(/^[0-9]+\.[0-9]{3}$/);
  });

<<<<<<< HEAD
  // Removed catalog listing test.

  it('create order + idempotent repeat', async () => {
  const payload = { publicCode, quantity: 1 };
=======
  it('list catalog', async () => {
    const res = await request(app.getHttpServer()).get('/api/tenant/external/v1/catalog/products').set('Authorization', 'Bearer ' + tokenFull).expect(200);
    expect(res.body[0].linkCode).toBe(linkCode);
  });

  it('create order + idempotent repeat', async () => {
    const payload = { linkCode, quantity: 1 };
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
    const first = await request(app.getHttpServer())
      .post('/api/tenant/external/v1/orders')
      .set('Authorization', 'Bearer ' + tokenFull)
      .set('Idempotency-Key', 'A1')
      .send(payload)
<<<<<<< HEAD
  .expect([200,201]); // accept 200 or 201 depending on controller implementation
=======
      .expect(201); // controller returns 201 Created for new order
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
    orderId = first.body.orderId;
    const second = await request(app.getHttpServer())
      .post('/api/tenant/external/v1/orders')
      .set('Authorization', 'Bearer ' + tokenFull)
      .set('Idempotency-Key', 'A1')
      .send(payload)
      .expect(200); // idempotent repeat returns cached 200
    expect(second.body.orderId).toBe(orderId);
  expect(second.headers['x-idempotency-cache']).toBe('HIT');
  });

  it('idempotency mismatch', async () => {
    const r = await request(app.getHttpServer())
      .post('/api/tenant/external/v1/orders')
      .set('Authorization', 'Bearer ' + tokenFull)
      .set('Idempotency-Key', 'A1')
<<<<<<< HEAD
  .send({ publicCode, quantity: 2 }) // different body
=======
      .send({ linkCode, quantity: 2 }) // different body
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
      .expect(409);
  expectEnvelope(r.body, 'IDEMPOTENCY_MISMATCH', 409);
    expect(r.body.path).toContain('/api/tenant/external/v1/orders');
  });

<<<<<<< HEAD
  it('invalid publicCode validation error', async () => {
=======
  it('invalid linkCode validation error', async () => {
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
    const r = await request(app.getHttpServer())
      .post('/api/tenant/external/v1/orders')
      .set('Authorization', 'Bearer ' + tokenFull)
      .set('Idempotency-Key', 'BAD1')
<<<<<<< HEAD
  .send({ publicCode: 999999, quantity: 1 })
=======
      .send({ linkCode: 'does_not_exist', quantity: 1 })
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
      .expect(422);
  expectEnvelope(r.body, 'VALIDATION_ERROR', 422);
  });

  it('cross-user forbidden or masked (notFound) on order fetch', async () => {
    const r = await request(app.getHttpServer())
      .get(`/api/tenant/external/v1/orders/${orderId}`)
      .set('Authorization', 'Bearer ' + tokenFull2);
    if (r.status === 403) {
      expect(['FORBIDDEN','MISSING_SCOPE']).toContain(r.body.code);
    } else {
      expect(r.status).toBe(200);
      expect(r.body.notFound).toBe(true);
    }
  });

  it('original user can fetch order', async () => {
    const r = await request(app.getHttpServer())
      .get(`/api/tenant/external/v1/orders/${orderId}`)
      .set('Authorization', 'Bearer ' + tokenFull)
      .expect(200);
    expect(r.body.orderId).toBe(orderId);
  });

  it('idempotency in-progress conflict', async () => {
    // Manually insert idempotency row without orderId then call endpoint
    const key = 'A2';
<<<<<<< HEAD
  const body = { publicCode, quantity: 1 };
    function stableStringify(v: any): string { if (v === null || typeof v !== 'object') return JSON.stringify(v); if (Array.isArray(v)) return '['+v.map(stableStringify).join(',')+']'; const ks = Object.keys(v).sort(); return '{'+ks.map(k=>JSON.stringify(k)+':'+stableStringify((v as any)[k])).join(',')+'}'; }
    const crypto = require('crypto');
  const requestHash = crypto.createHash('sha256').update('POST' + '|' + '/api/tenant/external/v1/orders' + '|' + stableStringify(body)).digest('hex');
=======
    const body = { linkCode, quantity: 1 };
    function stableStringify(v: any): string { if (v === null || typeof v !== 'object') return JSON.stringify(v); if (Array.isArray(v)) return '['+v.map(stableStringify).join(',')+']'; const ks = Object.keys(v).sort(); return '{'+ks.map(k=>JSON.stringify(k)+':'+stableStringify((v as any)[k])).join(',')+'}'; }
    const crypto = require('crypto');
    const requestHash = crypto.createHash('sha256').update('POST' + '|' + '/api/tenant/external/v1/orders' + '|' + stableStringify(body)).digest('hex');
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
    await ds.query(`INSERT INTO idempotency_keys(id, tokenId, key, requestHash, ttlSeconds, createdAt) VALUES($1,$2,$3,$4,86400,datetime('now'))`, [uuid(), tokenId, key, requestHash]);
    const r = await request(app.getHttpServer())
      .post('/api/tenant/external/v1/orders')
      .set('Authorization','Bearer '+tokenFull)
      .set('Idempotency-Key', key)
      .send(body)
      .expect(409);
  expectEnvelope(r.body, 'IDEMPOTENCY_IN_PROGRESS', 409);
  });

  it('rate limit after 60 (bucket reset)', async () => {
    // Reset bucket for this token id (test isolation)
    const rlKey = `ext:${tokenId}`;
    (__rateLimitBuckets as any).delete?.(rlKey);
    // First 60 requests (count 1..60) should pass; 61st (count=61) should 429 because interceptor blocks when count > LIMIT
    for (let i=0;i<60;i++) {
      await request(app.getHttpServer())
        .get('/api/tenant/external/v1/ping')
        .set('Authorization','Bearer '+tokenFull)
        .expect(200);
    }
    const r = await request(app.getHttpServer())
      .get('/api/tenant/external/v1/ping')
      .set('Authorization','Bearer '+tokenFull)
      .expect(429);
    expectEnvelope(r.body, 'RATE_LIMITED', 429);
    expect(r.headers['x-ratelimit-limit']).toBe('60');
  });
});
