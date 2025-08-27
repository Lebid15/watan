import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { FEATURE_FLAGS } from '../src/common/feature-flags';
import { seedTenantWithOwner, seedInvoice, seedPaymentMethod, seedNonOwner } from './utils/billing-test-helpers';
import { BillingInvoiceStatus } from '../src/billing/billing-invoice.entity';

function authHeader(token: string) { return { Authorization: `Bearer ${token}` }; }
async function login(app: INestApplication, email: string, password: string, tenantCode: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ emailOrUsername: email, password, tenantCode });
  return res.body?.token;
}

describe('Billing Tenant Overview & Invoices (e2e)', () => {
  let app: INestApplication; let ds: DataSource;
  let tenantId: string; let ownerToken: string; let userToken: string; let pmId: string;
  beforeAll(async () => {
    (FEATURE_FLAGS as any).billingV1 = true;
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    ds = app.get(DataSource, { strict: false });
    const { tenant, owner, passwordPlain } = await seedTenantWithOwner(ds, 1);
    tenantId = tenant.id;
    const pm = await seedPaymentMethod(ds, tenantId); pmId = pm.id;
    const nonOwner = await seedNonOwner(ds, tenantId, 2);
  ownerToken = await login(app, owner.email, passwordPlain, tenant.code);
  if (!ownerToken) throw new Error('Failed to login owner (token empty)');
  userToken = await login(app, nonOwner.user.email, nonOwner.passwordPlain, tenant.code);
  if (!userToken) throw new Error('Failed to login user (token empty)');
  });
  afterAll(async () => { if (app) await app.close(); if (ds?.isInitialized) await ds.destroy(); });

  it('overview empty initially', async () => {
  const res = await request(app.getHttpServer()).get('/api/tenant/billing/overview').set(authHeader(ownerToken)).set('X-Tenant-Id', tenantId).expect(200);
    expect(res.body).toHaveProperty('openInvoiceCount', 0);
    expect(res.body).toHaveProperty('status');
  });

  it('create overdue and future invoices then filter', async () => {
    const pastDue = new Date(Date.now() - 3*86400000);
    const dueFuture = new Date(Date.now() + 5*86400000);
    await seedInvoice(ds, tenantId, { amountUsd: '15.000000', dueAt: pastDue, issuedAt: new Date(Date.now()-4*86400000) });
    await seedInvoice(ds, tenantId, { amountUsd: '25.000000', dueAt: dueFuture, issuedAt: new Date() });
  const listAll = await request(app.getHttpServer()).get('/api/tenant/billing/invoices').set(authHeader(ownerToken)).set('X-Tenant-Id', tenantId).expect(200);
    expect(listAll.body.items.length).toBeGreaterThanOrEqual(2);
  const overdue = await request(app.getHttpServer()).get('/api/tenant/billing/invoices?overdue=true').set(authHeader(ownerToken)).set('X-Tenant-Id', tenantId).expect(200);
    expect(overdue.body.items.every((i: any)=> new Date(i.dueAt) < new Date())).toBe(true);
  const open = await request(app.getHttpServer()).get('/api/tenant/billing/invoices?status=open').set(authHeader(ownerToken)).set('X-Tenant-Id', tenantId).expect(200);
    expect(open.body.items.some((i:any)=> i.amountUsd === '15.000000' || i.amountUsd === '15' || Number(i.amountUsd) === 15)).toBe(true);
  });

  it('role enforcement (non-owner) overview/invoices 403', async () => {
  await request(app.getHttpServer()).get('/api/tenant/billing/overview').set(authHeader(userToken)).set('X-Tenant-Id', tenantId).expect(403);
  await request(app.getHttpServer()).get('/api/tenant/billing/invoices').set(authHeader(userToken)).set('X-Tenant-Id', tenantId).expect(403);
  });

  it('payment request validations', async () => {
  const invRes = await request(app.getHttpServer()).get('/api/tenant/billing/invoices').set(authHeader(ownerToken)).set('X-Tenant-Id', tenantId);
    const firstInvoiceId = invRes.body.items[0].id;
    // Missing method
  await request(app.getHttpServer()).post('/api/tenant/billing/payments/request').set(authHeader(ownerToken)).set('X-Tenant-Id', tenantId).send({ amountUsd: 10, invoiceId: firstInvoiceId }).expect(422);
    // Invalid amount
  await request(app.getHttpServer()).post('/api/tenant/billing/payments/request').set(authHeader(ownerToken)).set('X-Tenant-Id', tenantId).send({ amountUsd: 0, methodId: pmId }).expect(422);
    // Happy path
  await request(app.getHttpServer()).post('/api/tenant/billing/payments/request').set(authHeader(ownerToken)).set('X-Tenant-Id', tenantId).send({ amountUsd: 12.5, methodId: pmId, invoiceId: firstInvoiceId }).expect(201).expect(res => { if (!res.body.depositId) throw new Error('no depositId'); });
  });

  it('invoice not open -> 422', async () => {
  const invList = await request(app.getHttpServer()).get('/api/tenant/billing/invoices').set(authHeader(ownerToken)).set('X-Tenant-Id', tenantId);
    const target = invList.body.items[0];
    // Mark it paid via direct repository update
    const invRepo = ds.getRepository('billing_invoices'); // fallback string name
  // SQLite doesn't support NOW(); CURRENT_TIMESTAMP works.
  await ds.createQueryRunner().manager.query(`UPDATE billing_invoices SET status='paid', paidAt=CURRENT_TIMESTAMP WHERE id=$1`, [target.id]);
  await request(app.getHttpServer()).post('/api/tenant/billing/payments/request').set(authHeader(ownerToken)).set('X-Tenant-Id', tenantId).send({ amountUsd: 5, methodId: pmId, invoiceId: target.id }).expect(422);
  });
});
