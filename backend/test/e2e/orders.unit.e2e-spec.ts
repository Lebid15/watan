// Force Postgres for this spec only (Option 2)
process.env.NODE_ENV = 'test';
process.env.TEST_DB_SQLITE = 'false';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgres://watan:pass@127.0.0.1:54329/watan_test';
}
process.env.TYPEORM_MIGRATIONS_RUN = 'true';

import request from 'supertest';
const runPgE2E = process.env.E2E_PG_ENABLED === 'true';
const d = runPgE2E ? describe : describe.skip;
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';

// NOTE: This is a minimal illustrative E2E; assumes existing auth & seeding helpers.
// If real auth is required, you'd inject a token. Here we assume a test helper route or bypass (adjust as needed).

d('Orders E2E (Postgres)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let authHeader = {} as any; // Replace with real token retrieval if required
  let productId: string; let packageId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    ds = app.get(DataSource);

  // Seed minimal data using randomUUID (avoid uuid_generate_v4 dependency)
  const gen = () => (global as any).crypto?.randomUUID?.() || require('crypto').randomUUID();
  const tenantId = gen();
  const userId = gen();
  productId = gen();
  packageId = gen();
  await ds.query(`INSERT INTO tenant (id, name, "isActive") VALUES ($1,'E2ETenant',true)`, [tenantId]);
  await ds.query(`INSERT INTO users (id, "tenantId", email, password, balance, role, "isActive", overdraftLimit) VALUES ($1,$2,'unit-e2e@x.test','x',0,'user',true,0)`, [userId, tenantId]);
  await ds.query(`INSERT INTO product (id, "tenantId", name, "isActive", "supportsCounter") VALUES ($1,$2,'TestProductUnit',true,true)`, [productId, tenantId]);
  await ds.query(`INSERT INTO product_packages (id, "tenantId", "product_id", type, "baseUnitPrice", "minUnits", "maxUnits", step, capital, "isActive", "basePrice") VALUES ($1,$2,$3,'unit',1.2500,2,10,0.5,0.4000,true,0)`, [packageId, tenantId, productId]);
  // Simplistic auth bypass: many e2e tests rely on actual JWT; here we assume guard permissive or token not strictly validated.
  authHeader = {}; // Adjust if real auth required.
  });

  afterAll(async () => { try { if (ds?.isInitialized) await ds.destroy(); } catch {} await app.close(); });

  it('creates unit order successfully (quantity=2.5)', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({ productId, packageId, quantity: '2.5' })
      .set(authHeader);
    // Accept 200 or 201 depending on controller; here expecting 201? current controller returns 200.
    expect([200, 201]).toContain(res.status);
    expect(res.body.quantity).toBe('2.5');
    expect(res.body.unitPriceApplied).toBe('1.2500');
    expect(res.body.sellPrice).toBe('3.1250');
  });

  it('rejects below min', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({ productId, packageId, quantity: '1.0' })
      .set(authHeader);
    expect(res.status).toBe(400);
    expect(String(res.text)).toMatch(/ERR_QTY_BELOW_MIN|ERR_QUANTITY_REQUIRED/);
  });

  it('rejects above max', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({ productId, packageId, quantity: '11' })
      .set(authHeader);
    expect(res.status).toBe(400);
    expect(String(res.text)).toMatch(/ERR_QTY_ABOVE_MAX/);
  });

  it('rejects step mismatch', async () => {
    const res = await request(app.getHttpServer())
      .post('/orders')
      .send({ productId, packageId, quantity: '2.6' })
      .set(authHeader);
    expect(res.status).toBe(400);
    expect(String(res.text)).toMatch(/ERR_QTY_STEP_MISMATCH/);
  });
});
