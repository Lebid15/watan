import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';

// NOTE: This is a minimal illustrative E2E; assumes existing auth & seeding helpers.
// If real auth is required, you'd inject a token. Here we assume a test helper route or bypass (adjust as needed).

describe('Unit Orders E2E', () => {
  let app: INestApplication;
  let ds: DataSource;
  let authHeader = {} as any; // Replace with real token retrieval if required
  let productId: string; let packageId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    ds = app.get(DataSource);

    // Seed minimal product + unit package + user adjustments (pseudo—adjust to real schema if needed)
    const product = await ds.query(`INSERT INTO product (id, "tenantId", name, "isActive", "supportsCounter") VALUES (uuid_generate_v4(), uuid_generate_v4(), 'TestProductUnit', true, true) RETURNING id, "tenantId"`);
    productId = product[0].id;
    const tenantId = product[0].tenantId;
    const pkg = await ds.query(`INSERT INTO product_packages (id, "tenantId", "product_id", type, "baseUnitPrice", "minUnits", "maxUnits", step, capital, "isActive", basePrice) VALUES (uuid_generate_v4(), $1, $2, 'unit', 1.2500, 2, 10, 0.5, 0.4000, true, 0) RETURNING id`, [tenantId, productId]);
    packageId = pkg[0].id;
    // Assume an existing user linking (In real project use factories). Here we just rely on existing seeded user in tests env.
  });

  afterAll(async () => { await app.close(); });

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
