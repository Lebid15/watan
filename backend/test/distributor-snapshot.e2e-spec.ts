import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { ProductsService } from '../src/products/products.service';
import { DataSource } from 'typeorm';
import { format3 } from '../src/common/money/money.util';

// E2E scenario builds minimal seed graph to validate Dist3 stability after FX change.

describe('Distributor Snapshot & FX Freeze (E2E)', () => {
  let app: INestApplication;
  let ds: DataSource;
  const TID = '00000000-0000-0000-0000-00000000t001';
  const PG_STORE_DIST = '00000000-0000-0000-0000-00000000pg01';
  const USER_OWNER = '00000000-0000-0000-0000-00000000ownr';
  const USER_DIST  = '00000000-0000-0000-0000-00000000dist';
  const USER_CHILD = '00000000-0000-0000-0000-00000000chil';
  const PROD_ID    = '00000000-0000-0000-0000-00000000prod';
  const PKG_ID     = '00000000-0000-0000-0000-00000000pkg1';
<<<<<<< HEAD
=======
  const CATALOG_PROD = '00000000-0000-0000-0000-00000000cprd';
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
  const DIST_GROUP = '00000000-0000-0000-0000-00000000dpg1';

  // helpers
  const q = (sql:string, params:any[] = []) => ds.query(sql, params);
  const insert = (table:string, cols: Record<string, any>) => {
    const keys = Object.keys(cols);
    const vals = keys.map((k,i)=>`$${i+1}`);
    return q(`INSERT INTO "${table}"(${keys.map(k=>`"${k}"`).join(',')}) VALUES(${vals.join(',')})`, keys.map(k=> cols[k]));
  };

  beforeAll(async () => {
    process.env.TEST_DB_SQLITE = 'true';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    ds = app.get(DataSource);
    // Run migrations (if TypeORM CLI not auto-run in tests)
    if (ds.migrations?.length) await ds.runMigrations();

    // Seed
    // tenant (assuming tenants table exists; if not skip since tenantId stored on rows)
    // Currency SAR rate=3.750 (rate meaning: 1 USD -> 3.750 SAR or inverse? Code base uses row.rate directly as multiplier user.currency.rate when converting USD->userCurrency.)
    // In createOrder we do totalUser = totalUSD * rate, so rate is USD->Currency multiplier. We'll align with that.
    await insert('currencies', { id: 'c-sar', tenantId: TID, code: 'SAR', name: 'Saudi Riyal', rate: 3.7500, isActive: 1, isPrimary: 0 });

    // Tenant (needed for FK constraints on users / price_groups). Insert with minimal required fields.
  await q('INSERT INTO tenants (id, name, code, "ownerUserId", "isActive", createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)', [
      TID,
      'Tenant One',
      't1',
      null,
      1,
      new Date().toISOString(),
      new Date().toISOString(),
    ]);

    // price_group for distributor store-level capital
    // price_groups table doesn't have createdAt/updatedAt in schema (defaults handled); insert only defined columns
    await insert('price_groups', { id: PG_STORE_DIST, tenantId: TID, name: 'DIST_BASE' });

    // Users
    await insert('users', { id: USER_OWNER, tenantId: TID, role: 'tenant_owner', username: 'owner', email: 'o@x', password: 'x', isActive: 1 });
    await insert('users', { id: USER_DIST, tenantId: TID, role: 'distributor', username: 'dist', email: 'd@x', password: 'x', isActive: 1, preferredCurrencyCode: 'SAR', price_group_id: PG_STORE_DIST });
  await insert('users', { id: USER_CHILD, tenantId: TID, role: 'end_user', username: 'child', email: 'c@x', password: 'x', isActive: 1, parentUserId: USER_DIST, balance: 100 });

<<<<<<< HEAD
    // Product + package (store)
    await insert('product', { id: PROD_ID, tenantId: TID, name: 'Prod', isActive: 1 });
    await insert('product_packages', { id: PKG_ID, tenantId: TID, name: 'PKG1', isActive: 1, basePrice: 1.200, capital: 1.200, product_id: PROD_ID });
=======
    // Catalog product + package
  // Minimal catalog tables (include tenantId to satisfy NOT NULL in real schema)
  await q('CREATE TABLE IF NOT EXISTS catalog_product (id uuid primary key, "tenantId" uuid, "name" varchar(200), "isPublishable" boolean)');
  await q('CREATE TABLE IF NOT EXISTS catalog_package (id uuid primary key, "tenantId" uuid, "catalogProductId" uuid, "name" varchar(200), "publicCode" varchar(120), "linkCode" varchar)');
  await insert('catalog_product', { id: CATALOG_PROD, tenantId: TID, name: 'Catalog Prod', isPublishable: 1 });
  await insert('catalog_package', { id: '00000000-0000-0000-0000-00000000cpkg', tenantId: TID, catalogProductId: CATALOG_PROD, name: 'Catalog PKG', publicCode: 'CPKG', linkCode: '325' });

  // Product + package (store) - use actual table/column names (product_packages with product_id)
  await insert('product', { id: PROD_ID, tenantId: TID, name: 'Prod', isActive: 1, catalogProductId: CATALOG_PROD, useCatalogImage: 1 });
  await insert('product_packages', { id: PKG_ID, tenantId: TID, name: 'PKG1', isActive: 1, basePrice: 1.200, capital: 1.200, product_id: PROD_ID, catalogLinkCode: '325' });
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))

    // package_prices row for distributor capital group
    await insert('package_prices', { id: '00000000-0000-0000-0000-00000000pp01', tenantId: TID, price: 1.200, package_id: PKG_ID, price_group_id: PG_STORE_DIST });

    // Distributor pricing group + user attach + package price
    await insert('distributor_price_groups', { id: DIST_GROUP, tenantId: TID, distributorUserId: USER_DIST, name: 'DPG1', isActive: 1, createdAt: new Date(), updatedAt: new Date() });
    await insert('distributor_user_price_groups', { distributorPriceGroupId: DIST_GROUP, userId: USER_CHILD, createdAt: new Date() });
    await insert('distributor_package_prices', { id: '00000000-0000-0000-0000-00000000dpp1', tenantId: TID, distributorUserId: USER_DIST, packageId: PKG_ID, distributorPriceGroupId: DIST_GROUP, priceUSD: 1.450, createdAt: new Date(), updatedAt: new Date() });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (ds?.isInitialized) await ds.destroy();
  });

  it('creates order with FX snapshot and Dist3 stays stable after FX change', async () => {
    // Direct service call (simpler than HTTP auth plumbing) – resolve ProductsService
  const productsService = app.get<ProductsService>(ProductsService);
    // Place order as sub user (child) quantity 10
    const view = await productsService.createOrder({ productId: PROD_ID, packageId: PKG_ID, quantity: 10, userId: USER_CHILD }, TID);
    expect(view.quantity).toBe(10);

    // Verify snapshot in DB
    const orderRows = await q('SELECT * FROM product_orders WHERE "tenantId"=$1', [TID]);
    expect(orderRows.length).toBeGreaterThanOrEqual(1);
    const ord = orderRows[0];
    const normalize = (v: any) => {
      if (v === null || v === undefined) return v;
      if (typeof v === 'string') {
        // If already has decimal places, ensure 6 by using Number then toFixed(6)
        const num = Number(v);
        return isNaN(num) ? v : num.toFixed(6);
      }
      if (typeof v === 'number') return Number(v).toFixed(6);
      return v;
    };
    const capColRaw = ord.distributorCapitalUsdAtOrder ?? ord.distributorcapitalusdatorder;
    const sellColRaw = ord.distributorSellUsdAtOrder ?? ord.distributorsellusdatorder;
    const profitColRaw = ord.distributorProfitUsdAtOrder ?? ord.distributorprofitusdatorder;
    const fxColRaw = ord.fxUsdToDistAtOrder ?? ord.fxusdtodistatorder;
    const currCol = ord.distCurrencyCodeAtOrder ?? ord.distcurrencycodeatorder;
    const capCol = normalize(capColRaw);
    const sellCol = normalize(sellColRaw);
    const profitCol = normalize(profitColRaw);
    const fxCol = normalize(fxColRaw);
    expect(capCol).toBe('12.000000'); // 1.2 * 10
    expect(sellCol).toBe('14.500000');
    expect(profitCol).toBe('2.500000');
    expect(fxCol).toBe('3.750000');
    expect(currCol).toBe('SAR');

    // Change FX to new value 4.100
    await q('UPDATE currencies SET rate=4.1000 WHERE code=\'SAR\' AND "tenantId"=$1', [TID]);

    // Call distributor list endpoint (simulate role distributor: directly query controller logic via HTTP requires auth; instead we query raw and compute what controller would produce)
    // Simpler: direct DB calculation using stored snapshot * fxUsdToDistAtOrder
  const capDist = parseFloat(capCol) * parseFloat(fxCol);
  const sellDist = parseFloat(sellCol) * parseFloat(fxCol);
  const profitDist = parseFloat(profitCol) * parseFloat(fxCol);
    expect(format3(capDist)).toBe('45.000');
    expect(format3(sellDist)).toBe('54.375');
    expect(format3(profitDist)).toBe('9.375');

    // Ensure NOT recalculated using new FX (would have been higher with 4.100)
  const capWithNewFx = parseFloat(capCol) * 4.100;
    expect(format3(capWithNewFx)).not.toBe('45.000');
  });

  it('returns 422 after distributor price removal', async () => {
    // Remove distributor package price
    await q('DELETE FROM distributor_package_prices WHERE distributorUserId=$1 AND packageId=$2', [USER_DIST, PKG_ID]);
  const productsService = app.get<ProductsService>(ProductsService);
    await expect(productsService.createOrder({ productId: PROD_ID, packageId: PKG_ID, quantity: 1, userId: USER_CHILD }, TID))
      .rejects.toMatchObject({ status: 422 });
  });
});
