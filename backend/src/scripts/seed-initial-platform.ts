/*
 * seed-initial-platform.ts
 * Idempotent platform bootstrap seed.
 * Creates:
 *  - Developer user (role=developer)
 *  - Default tenant (code=sham)
 *  - Tenant domain sham.syrz1.com
 *  - Basic currencies USD / TRY
 *  - Demo payment method
 *  - Basic site settings (about/infoes)
 */
import 'reflect-metadata';
import dataSource from '../data-source';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { TenantDomain } from '../tenants/tenant-domain.entity';
import { User } from '../user/user.entity';
import { Currency } from '../currencies/currency.entity';
import { PaymentMethod, PaymentMethodType } from '../payments/payment-method.entity';
import { SiteSetting } from '../admin/site-setting.entity';
import * as argon2 from 'argon2';

const DEV_EMAIL = process.env.INIT_DEV_EMAIL || 'dev@example.com';
const DEV_PASSWORD = process.env.INIT_DEV_PASSWORD || 'dev12345';
const TENANT_CODE = 'sham';
const TENANT_DOMAIN = 'sham.syrz1.com';

async function ensureTenant(repo: Repository<Tenant>): Promise<Tenant> {
  let t = await repo.findOne({ where: { code: TENANT_CODE } });
  if (!t) {
    t = repo.create({ code: TENANT_CODE, name: 'Sham Default Tenant', isActive: true });
    await repo.save(t);
    console.log('[seed] Created tenant', t.id);
  }
  return t;
}

async function ensureTenantDomain(repo: Repository<TenantDomain>, tenantId: string) {
  let d = await repo.findOne({ where: { domain: TENANT_DOMAIN } });
  if (!d) {
    d = repo.create({ tenantId, domain: TENANT_DOMAIN, type: 'subdomain', isPrimary: true, isVerified: true });
    await repo.save(d);
    console.log('[seed] Created tenant domain', TENANT_DOMAIN);
  }
  return d;
}

async function ensureDeveloper(userRepo: Repository<User>): Promise<User> {
  let dev = await userRepo.findOne({ where: { email: DEV_EMAIL } });
  if (!dev) {
    const hash = await argon2.hash(DEV_PASSWORD, { type: argon2.argon2id });
    dev = userRepo.create({ email: DEV_EMAIL, password: hash, role: 'developer', tenantId: null, balance: 0 });
    await userRepo.save(dev);
    console.log('[seed] Created developer user', DEV_EMAIL);
  }
  return dev;
}

async function ensureCurrency(repo: Repository<Currency>, tenantId: string, code: string, rate: number, primary = false) {
  let c = await repo.findOne({ where: { tenantId, code } });
  if (!c) {
    c = repo.create({ tenantId, code, rate, isActive: true, isPrimary: primary, name: code, symbolAr: code });
    await repo.save(c);
    console.log('[seed] Created currency', code);
  }
  return c;
}

async function ensurePaymentMethod(repo: Repository<PaymentMethod>, tenantId: string) {
  let pm = await repo.findOne({ where: { tenantId, name: 'Manual Demo Method' } });
  if (!pm) {
    pm = repo.create({ tenantId, name: 'Manual Demo Method', type: PaymentMethodType.CASH_BOX, isActive: false, config: {} });
    await repo.save(pm);
    console.log('[seed] Created payment method');
  }
  return pm;
}

async function ensureSiteSetting(repo: Repository<SiteSetting>, tenantId: string, key: string, value: string) {
  let s = await repo.findOne({ where: { tenantId, key } });
  if (!s) {
    s = repo.create({ tenantId, key, value });
    await repo.save(s);
    console.log('[seed] Created site setting', key);
  }
  return s;
}

async function run() {
  await dataSource.initialize();
  const tenantRepo = dataSource.getRepository(Tenant);
  const domainRepo = dataSource.getRepository(TenantDomain);
  const userRepo = dataSource.getRepository(User);
  const currencyRepo = dataSource.getRepository(Currency);
  const paymentMethodRepo = dataSource.getRepository(PaymentMethod);
  const siteRepo = dataSource.getRepository(SiteSetting);

  const tenant = await ensureTenant(tenantRepo);
  await ensureTenantDomain(domainRepo, tenant.id);
  await ensureDeveloper(userRepo);
  await ensureCurrency(currencyRepo, tenant.id, 'USD', 1, true);
  await ensureCurrency(currencyRepo, tenant.id, 'TRY', 32, false);
  await ensurePaymentMethod(paymentMethodRepo, tenant.id);
  await ensureSiteSetting(siteRepo, tenant.id, 'about', 'About content placeholder');
  await ensureSiteSetting(siteRepo, tenant.id, 'infoes', 'Infoes content placeholder');

  console.log('\n✅ Seed initial platform complete');
  process.exit(0);
}

run().catch(e => { console.error('Seed failed', e); process.exit(1); });
