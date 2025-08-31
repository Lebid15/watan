/*
 * Minimal idempotent demo data seeding.
 * Run with (dev):  npx ts-node -r tsconfig-paths/register src/scripts/seed-demo-data.ts
 * Optionally specify TENANT_ID to target a specific tenant. Otherwise uses FALLBACK_TENANT_ID or the first tenant.
 * Only creates baseline currencies (USD, TRY) and ensures one example payment method (disabled by default).
 */
import 'reflect-metadata';
import dataSource from '../data-source';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { Currency } from '../currencies/currency.entity';
import { PaymentMethod, PaymentMethodType } from '../payments/payment-method.entity';

async function ensureCurrency(repo: Repository<Currency>, tenantId: string, code: string, rate: number, opts: Partial<Currency> = {}) {
  let cur = await repo.findOne({ where: { code, tenantId } });
  if (!cur) {
    cur = repo.create({ code, rate, tenantId, isActive: true, isPrimary: code === 'USD', name: code, ...opts });
    await repo.save(cur);
    console.log('Created currency', code, 'tenant', tenantId); // eslint-disable-line no-console
  }
  return cur;
}

async function ensurePaymentMethod(repo: Repository<PaymentMethod>, tenantId: string, name: string, type: PaymentMethodType) {
  let pm = await repo.findOne({ where: { tenantId, name } });
  if (!pm) {
    pm = repo.create({ tenantId, name, type, isActive: false, config: {} });
    await repo.save(pm);
    console.log('Created demo payment method', name, 'tenant', tenantId); // eslint-disable-line no-console
  }
  return pm;
}

async function run() {
  await dataSource.initialize();
  const tenantRepo = dataSource.getRepository(Tenant);
  const currencyRepo = dataSource.getRepository(Currency);
  const paymentMethodRepo = dataSource.getRepository(PaymentMethod);

  const explicitTenant = process.env.TENANT_ID || process.env.FALLBACK_TENANT_ID || null;
  let tenantId: string | null = explicitTenant;

  if (!tenantId) {
    const first = await tenantRepo.find({ take: 1, order: { createdAt: 'ASC' as any } });
    tenantId = first[0]?.id || null;
  }

  if (!tenantId) throw new Error('No tenant found for seeding (set TENANT_ID or create a tenant first)');

  await ensureCurrency(currencyRepo, tenantId, 'USD', 1, { isPrimary: true, name: 'US Dollar', symbolAr: '$' });
  await ensureCurrency(currencyRepo, tenantId, 'TRY', 32, { name: 'Turkish Lira', symbolAr: '₺' });
  await ensurePaymentMethod(paymentMethodRepo, tenantId, 'Manual Demo Method', PaymentMethodType.CASH_BOX);

  // eslint-disable-next-line no-console
  console.log('Seed complete. Tenant used:', tenantId);
  process.exit(0);
}

run().catch(err => {
  // eslint-disable-next-line no-console
  console.error('Seed failed', err);
  process.exit(1);
});
