#!/usr/bin/env ts-node
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { TenantDomain } from '../tenants/tenant-domain.entity';
import { User } from '../user/user.entity';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { config } from 'dotenv';
config({ path: process.env.ENV_FILE || '.env' });

// Minimal dynamic import of data-source to avoid circular build issues
import dsDefault from '../data-source';

interface Args { host:string; name:string; adminEmail:string; adminPass:string; }

function parseArgs(): Args {
  const a: any = {};
  for (let i=2;i<process.argv.length;i++) {
    const p = process.argv[i];
    if (p.startsWith('--')) {
      const key = p.slice(2);
      const val = process.argv[i+1];
      a[key.replace(/-([a-z])/g, (_:any,g:string)=>g.toUpperCase())] = val; i++;
    }
  }
  if (!a.host || !a.name || !a.adminEmail || !a.adminPass) {
    console.error('Usage: ts-node create-tenant.ts --host sub.wtn4.com --name "Name" --admin-email a@b.com --admin-pass pass');
    process.exit(1);
  }
  return { host:a.host, name:a.name, adminEmail:a.adminEmail, adminPass:a.adminPass };
}

async function main() {
  const args = parseArgs();
  const ds: DataSource = await (await dsDefault).initialize?.() || (dsDefault as any);
  const tenants = ds.getRepository(Tenant);
  const domains = ds.getRepository(TenantDomain);
  const users = ds.getRepository(User);

  const base = (process.env.PUBLIC_TENANT_BASE_DOMAIN || 'localhost').toLowerCase();
  if (!args.host.endsWith('.'+base) && args.host !== base) {
    console.error(`Host must end with .${base}`); process.exit(1);
  }
  const sub = args.host === base ? 'root' : args.host.replace('.'+base,'');

  // Upsert tenant by code=sub
  let tenant = await tenants.findOne({ where:{ code: sub } });
  if (!tenant) {
    tenant = tenants.create({ id: randomUUID(), code: sub, name: args.name, isActive: true } as any as Tenant);
    tenant = await tenants.save(tenant as any);
  } else if ((tenant as any).name !== args.name) {
    (tenant as any).name = args.name;
    tenant = await tenants.save(tenant as any);
  }

  // Upsert admin user
  let admin = await users.findOne({ where:{ email: args.adminEmail } });
  if (!admin) {
    admin = users.create({ id: randomUUID(), email: args.adminEmail, password: await bcrypt.hash(args.adminPass,10), role:'ADMIN', tenantId: (tenant as any).id } as any as User);
    admin = await users.save(admin as any);
  } else {
    if (!(admin as any).tenantId) { (admin as any).tenantId = (tenant as any).id; }
    if ((admin as any).role !== 'ADMIN') (admin as any).role = 'ADMIN';
    admin.password = await bcrypt.hash(args.adminPass,10); // ensure known pass
    admin = await users.save(admin as any);
  }
  (tenant as any).ownerUserId = (admin as any).id; await tenants.save(tenant as any);

  // Upsert domain
  let domain = await domains.findOne({ where:{ domain: args.host } });
  if (!domain) {
    domain = domains.create({ id: randomUUID(), tenantId: (tenant as any).id, domain: args.host, type:'subdomain', isPrimary:true, isVerified:true } as any as TenantDomain);
    await domains.update({ tenantId: (tenant as any).id, isPrimary: true }, { isPrimary: false });
    domain = await domains.save(domain as any);
  } else if (!domain.isPrimary) {
    domain.isPrimary = true as any;
    domain = await domains.save(domain as any);
  }

  console.log(JSON.stringify({ tenantId: (tenant as any).id, domainId: (domain as any).id, adminUserId: (admin as any).id }, null, 2));
  await ds.destroy();
}

main().catch(e=>{ console.error(e); process.exit(1); });
