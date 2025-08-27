import { DataSource } from 'typeorm';
import { Tenant } from '../../src/tenants/tenant.entity';
import { User } from '../../src/user/user.entity';
import { PaymentMethod, PaymentMethodType } from '../../src/payments/payment-method.entity';
import { BillingInvoice, BillingInvoiceStatus } from '../../src/billing/billing-invoice.entity';
import { TenantSubscription, TenantSubscriptionStatus } from '../../src/billing/tenant-subscription.entity';
import { hash } from 'bcryptjs';

export async function seedTenantWithOwner(ds: DataSource, idx=1) {
  const tenantRepo = ds.getRepository(Tenant);
  const userRepo = ds.getRepository(User);
  const tenant = tenantRepo.create({ name: `Tenant${idx}`, code: `tenant${idx}` });
  await tenantRepo.save(tenant);
  const password = await hash('Pass1234', 4);
  const owner = userRepo.create({ email: `owner${idx}@example.com`, password, role: 'tenant_owner', tenantId: tenant.id, isActive: true, balance: 0, overdraftLimit:0 });
  await userRepo.save(owner);
  return { tenant, owner, passwordPlain: 'Pass1234' };
}

export async function seedNonOwner(ds: DataSource, tenantId: string, idx=1) {
  const userRepo = ds.getRepository(User);
  const password = await hash('Pass1234', 4);
  const user = userRepo.create({ email: `user${idx}@example.com`, password, role: 'user', tenantId, isActive: true, balance:0, overdraftLimit:0 });
  await userRepo.save(user);
  return { user, passwordPlain: 'Pass1234' };
}

export async function seedPaymentMethod(ds: DataSource, tenantId: string) {
  const pmRepo = ds.getRepository(PaymentMethod);
  const pm = pmRepo.create({ tenantId, name: 'DefaultMethod', type: PaymentMethodType.CASH_BOX, isActive: true, config: {} });
  await pmRepo.save(pm);
  return pm;
}

export async function seedInvoice(ds: DataSource, tenantId: string, opts: Partial<BillingInvoice>) {
  const repo = ds.getRepository(BillingInvoice);
  const inv = repo.create({ tenantId, amountUsd: (opts.amountUsd || '10.000000'), periodStart: opts.periodStart || '2025-01-01', periodEnd: opts.periodEnd || '2025-01-31', status: opts.status || BillingInvoiceStatus.OPEN, issuedAt: opts.issuedAt || new Date(), dueAt: opts.dueAt || new Date(), ...opts });
  await repo.save(inv);
  return inv;
}

export async function setSubscriptionSuspended(ds: DataSource, tenantId: string) {
  const repo = ds.getRepository(TenantSubscription);
  let sub = await repo.findOne({ where: { tenantId } });
  if (!sub) { sub = repo.create({ tenantId }); }
  sub.status = TenantSubscriptionStatus.SUSPENDED;
  sub.suspendAt = new Date();
  sub.suspendReason = 'billing_overdue';
  await repo.save(sub);
  return sub;
}
