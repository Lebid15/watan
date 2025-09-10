import { BadRequestException, Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';

import { Tenant } from './tenant.entity';
import { TenantDomain } from './tenant-domain.entity';

import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { AddDomainDto } from './dto/add-domain.dto';
import { PatchDomainDto } from './dto/patch-domain.dto';

import * as bcrypt from 'bcrypt';
import { User } from '../user/user.entity';
import { UserRole } from '../auth/user-role.enum';
import { AuditService } from '../audit/audit.service';

const RESERVED_CODES = new Set(['www', 'admin', 'dev', 'api', 'static', 'cdn', 'assets']);

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private tenants: Repository<Tenant>,
    @InjectRepository(TenantDomain) private domains: Repository<TenantDomain>,
    @InjectRepository(User) private users: Repository<User>,
    private readonly ds: DataSource,
    private readonly audit: AuditService,
  ) {}

  // كلمة مرور مؤقتة (dev فقط)
  private generateTempPassword(len = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let out = '';
    for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  private ensureCodeAllowed(code: string) {
    if (RESERVED_CODES.has(code)) {
      throw new BadRequestException('هذا الكود محجوز');
    }
  }

  // ===== Tenants =====

  async listTenants(includeTrashed = false) {
    return this.tenants.find({ withDeleted: includeTrashed, order: { createdAt: 'DESC' } });
  }

  async listTenantsPaged(params: { status: 'active'|'trashed'|'all'; page: number; limit: number }) {
    const { status, page, limit } = params;
    const qb = this.tenants.createQueryBuilder('t');
    if (status === 'active') qb.andWhere('t.deleted_at IS NULL');
    if (status === 'trashed') qb.andWhere('t.deleted_at IS NOT NULL');
    qb.orderBy('t.createdAt', 'DESC').skip((page - 1) * limit).take(limit);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit };
  }

  async getTenant(id: string, includeTrashed = false) {
    const t = await this.tenants.findOne({ where: { id }, withDeleted: includeTrashed });
    if (!t) throw new NotFoundException('Tenant not found');
    return t;
  }

  async createTenant(dto: CreateTenantDto) {
    if (dto.code) this.ensureCodeAllowed(dto.code);

    const exists = await this.tenants.findOne({ where: { code: dto.code } });
    if (exists) throw new BadRequestException('الكود مستخدم من قبل');

    // 1) تجهيز سجل المتجر
  const t = this.tenants.create({ ...dto, isActive: dto.isActive ?? true });
  // فfallback: لو لم يضبط الـ DB default للـ id (حالة إنتاج قديمة) نولّد UUID يدوياً
  if (!(t as any).id) (t as any).id = randomUUID();

    let ownerPlainPassword: string | undefined;

    // 2) إنشاء/ربط مالك المتجر إن أُرسل بريد
    if (dto.ownerEmail) {
      let user: User | null = await this.users.findOne({ where: { email: dto.ownerEmail } });

      if (!user) {
        // أنشئ مستخدم جديد بدور ADMIN
        ownerPlainPassword = this.generateTempPassword();
        const hash = await bcrypt.hash(ownerPlainPassword, 10);

        // صرّحنا بالنوع صراحةً لتجنّب اختيار overload المصفوفة
        const newUser: User = this.users.create({
          email: dto.ownerEmail,
          password: hash,
          role: UserRole.ADMIN,
          // أضف حقولًا إضافية لو موجودة في الـ entity عندك:
          // name: dto.ownerName,
          // isActive: true as any,
        } as Partial<User>) as User;

        user = await this.users.save(newUser);
      } else {
        // ارفع الدور إلى ADMIN (اختياري)
        if (user.role !== UserRole.ADMIN) {
          user.role = UserRole.ADMIN;
          user = await this.users.save(user);
        }
      }

      // اربط مالك المتجر
      (t as any).ownerUserId = (user as any).id;
    }

    // 3) احفظ المتجر
  const savedTenant = await this.tenants.save(t);

    // Ensure owner user (if any) is linked to this tenant (tenantId nullable globally but owners should be scoped)
    if ((savedTenant as any).ownerUserId) {
      const owner = await this.users.findOne({ where: { id: (savedTenant as any).ownerUserId } as any });
      if (owner && !owner.tenantId) {
        owner.tenantId = savedTenant.id;
        try { await this.users.save(owner); } catch (e) { /* ignore if constraint or race */ }
      }
    }

  // 4) أنشئ نطاق افتراضي ديناميكي: code.<baseDomain>
  const baseDomain = (process.env.PUBLIC_TENANT_BASE_DOMAIN || 'localhost').toLowerCase();
  const defaultDomain = `${dto.code}.${baseDomain}`;
    const domainEntity: TenantDomain = this.domains.create({
      tenantId: savedTenant.id,
      domain: defaultDomain,
      type: 'subdomain',
      isPrimary: true,
      isVerified: true, // محليًا نعتبره متحققًا
    } as Partial<TenantDomain>) as TenantDomain;
    if (!(domainEntity as any).id) (domainEntity as any).id = randomUUID();

    await this.domains.save(domainEntity);

    // 5) أعد البيانات + كلمة السر المؤقتة (dev فقط)
    // إعطاء كلمة المرور المؤقتة دائماً (بناءً على طلب المستخدم) حتى في بيئة الإنتاج.
    // ملاحظة أمان: هذا يُعرِّض الكلمة في الواجهة؛ يُفضل لاحقاً وضع متغير بيئة لتعطيله.
    return {
      tenant: savedTenant,
      defaultDomain,
      ownerEmail: dto.ownerEmail || null,
      ownerTempPassword: ownerPlainPassword || undefined,
    };
  }

  async resetOwnerPassword(tenantId: string) {
    const t = await this.getTenant(tenantId);
    if (!(t as any).ownerUserId) throw new BadRequestException('لا يوجد مالك مرتبط بهذا المتجر');

    const user = await this.users.findOne({ where: { id: (t as any).ownerUserId } as any });
    if (!user) throw new NotFoundException('مالك المتجر غير موجود');

    const plain = this.generateTempPassword();
    user.password = await bcrypt.hash(plain, 10);
    await this.users.save(user);

    // إعادة: إرجاع الكلمة دائماً وفق المتطلب الحالي
    return {
      ownerEmail: (user as any).email,
      ownerTempPassword: plain,
    };
  }

  async updateTenant(id: string, dto: UpdateTenantDto & { ownerEmail?: string }) {
    const t = await this.getTenant(id);
    if (dto.code) {
      // enforce slug <= 40 and safe
      if (!/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/.test(dto.code)) throw new BadRequestException('Invalid code slug');
      this.ensureCodeAllowed(dto.code);
      const dup = await this.tenants.findOne({ where: { code: dto.code, id: Not(id) } });
      if (dup) throw new BadRequestException('الكود مستخدم من قبل');
    }

    // ownerEmail handling
    if (dto.ownerEmail) {
      let user: User | null = await this.users.findOne({ where: { email: dto.ownerEmail } });
      if (!user) {
        const pw = this.generateTempPassword();
        const hash = await bcrypt.hash(pw, 10);
        const created = this.users.create({ email: dto.ownerEmail, password: hash, role: UserRole.ADMIN } as Partial<User>);
        user = await this.users.save(created as any);
      } else if (user.role !== UserRole.ADMIN) {
        user.role = UserRole.ADMIN;
        user = await this.users.save(user);
      }
      if (user) {
        (t as any).ownerUserId = user.id;
        if (!user.tenantId) {
          user.tenantId = t.id;
          try { await this.users.save(user); } catch {}
        }
      }
    }

    const before = { ...t };
    Object.assign(t, { name: dto.name ?? t.name, code: dto.code ?? t.code, isActive: dto.isActive ?? t.isActive });
    const after = await this.tenants.save(t);
    try { await this.audit.log('TENANT_EDIT', { targetTenantId: id, meta: { before, after } }); } catch {}
    return after;
  }

  async deleteTenant(id: string, hard = false, opts?: { hard?: string; confirm?: string }) {
    if (hard) {
      const tenant = await this.getTenant(id, true);
      if (!opts?.hard || opts.hard.toLowerCase() !== 'true' || !opts.confirm || opts.confirm !== (tenant as any).code) {
        throw new ForbiddenException('Hard delete requires ?hard=true&confirm=<tenantCode>');
      }
      // Preconditions (balances and invoices)
      const balanceCount = await this.users.count({ where: { tenantId: id, balance: Not(0 as any) } as any });
      const openInvoices = await this.ds.getRepository('billing_invoices').createQueryBuilder('bi').where('bi.tenantId = :id AND bi.status = :st', { id, st: 'open' }).getCount();
      if (balanceCount > 0 || openInvoices > 0) {
        throw new ConflictException({ error: 'precondition_failed', balances: balanceCount, openInvoices });
      }
      // Tx: unlink users then hard delete
      await this.ds.transaction(async (em) => {
        await em.getRepository(User).createQueryBuilder().update(User).set({ tenantId: null as any }).where('tenantId = :id', { id }).execute();
        await em.getRepository(Tenant).delete(id);
      });
      try { await this.audit.log('TENANT_DELETE_HARD', { targetTenantId: id }); } catch {}
      return { ok: true, hard: true };
    } else {
      await this.getTenant(id);
      await this.ds.transaction(async (em) => {
        await em.getRepository(Tenant).softDelete(id);
        await em.getRepository(Tenant).update(id, { isActive: false } as any);
        await em.getRepository(TenantDomain).softDelete({ tenantId: id } as any);
      });
      try { await this.audit.log('TENANT_TRASH', { targetTenantId: id }); } catch {}
      return { ok: true, hard: false };
    }
  }

  async restoreTenant(id: string) {
    const t = await this.getTenant(id, true);
    if (!(t as any).deleted_at) return { ok: true, restored: false };

    // Check tenant.code conflict among active tenants
    if ((t as any).code) {
      const conflict = await this.tenants.findOne({ where: { code: (t as any).code } });
      if (conflict) {
        const short = Math.random().toString(36).slice(2, 8);
        const suggestion = `${(t as any).code}-${short}`.slice(0, 40);
        throw new ConflictException({ error: 'conflict', conflicts: { code: true, domains: [] }, suggestion: { code: suggestion, domains: {} } });
      }
    }

    // Domains conflicts
    const domains = await this.domains.find({ where: { tenantId: id }, withDeleted: true });
    const conflictDomains: string[] = [];
    const domainSuggestions: Record<string, string> = {};
    for (const d of domains) {
      if ((d as any).deleted_at == null) continue; // only care about trashed ones
      const active = await this.domains.findOne({ where: { domain: d.domain } });
      if (active) {
        conflictDomains.push(d.domain);
        const alt = d.domain.replace(/^[^.]+/, (m) => `${m}-${Math.random().toString(36).slice(2, 6)}`);
        domainSuggestions[d.domain] = alt;
      }
    }
    if (conflictDomains.length) {
      throw new ConflictException({ error: 'conflict', conflicts: { code: false, domains: conflictDomains }, suggestion: { domains: domainSuggestions } });
    }

    await this.ds.transaction(async (em) => {
      await em.getRepository(Tenant).restore(id);
      await em.getRepository(Tenant).update(id, { isActive: true } as any);
      await em.getRepository(TenantDomain).restore({ tenantId: id } as any);
    });
    try { await this.audit.log('TENANT_RESTORE', { targetTenantId: id }); } catch {}
    return { ok: true, restored: true };
  }

  // ===== Domains =====

  async listDomains(tenantId: string) {
    return this.domains.find({ where: { tenantId }, order: { createdAt: 'DESC' } });
  }

  async addDomain(tenantId: string, dto: AddDomainDto) {
    await this.getTenant(tenantId);
    const dupe = await this.domains.findOne({ where: { domain: dto.domain } });
    if (dupe) throw new BadRequestException('النطاق مستخدم من قبل');

    const d: TenantDomain = this.domains.create({
      tenantId,
      domain: dto.domain,
      type: dto.type,
      isPrimary: !!dto.isPrimary,
      isVerified: dto.type === 'subdomain' ? true : false,
    } as Partial<TenantDomain>) as TenantDomain;

    if (d.isPrimary) {
      await this.domains.update({ tenantId, isPrimary: true }, { isPrimary: false });
    }

    return this.domains.save(d);
  }

  async patchDomain(tenantId: string, domainId: string, dto: PatchDomainDto) {
    const d = await this.domains.findOne({ where: { id: domainId, tenantId } });
    if (!d) throw new NotFoundException('Domain not found');

    if (dto.isPrimary === true) {
      await this.domains.update({ tenantId, isPrimary: true }, { isPrimary: false });
      d.isPrimary = true;
    } else if (dto.isPrimary === false) {
      d.isPrimary = false;
    }

    if (typeof dto.isVerified === 'boolean') d.isVerified = dto.isVerified;

    return this.domains.save(d);
  }

  async deleteDomain(tenantId: string, domainId: string) {
    await this.domains.delete({ id: domainId, tenantId });
    return { ok: true };
  }
}
