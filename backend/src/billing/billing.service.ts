import { Injectable, NotFoundException, BadRequestException, Logger, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { TenantBillingConfig } from './tenant-billing-config.entity';
import { TenantSubscription, TenantSubscriptionStatus } from './tenant-subscription.entity';
import { BillingInvoice, BillingInvoiceStatus } from './billing-invoice.entity';
import { isFeatureEnabled } from '../common/feature-flags';
import { Tenant } from '../tenants/tenant.entity';
import { Deposit } from '../payments/deposit.entity';
import { PaymentMethod } from '../payments/payment-method.entity';
import { computePeriodAndIssuance, isFirstMonthFree, computeDueAt, computeNextDueAt, nextIssuanceTimestampAfter, buildMonthlyPeriod } from './billing-utils';
import { billingCounters } from './billing.metrics';

@Injectable()
export class BillingService {
  private readonly logger = new Logger('BillingService');
  constructor(
    @InjectRepository(TenantBillingConfig) private configRepo: Repository<TenantBillingConfig>,
    @InjectRepository(TenantSubscription) private subRepo: Repository<TenantSubscription>,
    @InjectRepository(BillingInvoice) private invRepo: Repository<BillingInvoice>,
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(Deposit) private depositRepo: Repository<Deposit>,
    private dataSource: DataSource,
  ) {}

  ensureBillingEnabled() {
    if (!isFeatureEnabled('billingV1')) throw new BadRequestException('Billing disabled');
  }

  async getOrCreateConfig(tenantId: string): Promise<TenantBillingConfig> {
    let cfg = await this.configRepo.findOne({ where: { tenantId } });
    if (!cfg) {
      cfg = this.configRepo.create({ tenantId, monthlyPriceUsd: null });
      await this.configRepo.save(cfg);
    }
    return cfg;
  }

  async getOrCreateSubscription(tenantId: string): Promise<TenantSubscription> {
    let sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub) {
      sub = this.subRepo.create({ tenantId });
      await this.subRepo.save(sub);
    }
    return sub;
  }

  async listInvoices(tenantId: string, status?: BillingInvoiceStatus): Promise<BillingInvoice[]> {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.invRepo.find({ where, order: { issuedAt: 'DESC' } });
  }

  async markInvoicePaid(id: string, depositId: string | null) {
    const inv = await this.invRepo.findOne({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    inv.status = BillingInvoiceStatus.PAID;
    inv.paidAt = new Date();
    if (depositId) inv.depositId = depositId;
    await this.invRepo.save(inv);
    const sub = await this.getOrCreateSubscription(inv.tenantId);
    sub.status = TenantSubscriptionStatus.ACTIVE;
    sub.lastPaidAt = new Date();
    sub.suspendAt = null; sub.suspendReason = null;
    await this.subRepo.save(sub);
    return inv;
  }

  /* ================== Phase5 Core Public Methods (Feature Flag Protected) ================== */

  async issueMonthlyInvoices(nowUTC: Date): Promise<{ created: number; skipped: number }> {
    if (!isFeatureEnabled('billingV1')) return { created: 0, skipped: 0 };
    const { periodStart, periodEnd, issuedAt } = computePeriodAndIssuance(nowUTC);
    const rows = await this.getTenantConfigsForBilling();
    let created = 0, skipped = 0;
    for (const { tenant, config, subscription } of rows) {
      if (isFirstMonthFree(tenant.createdAt, periodStart, periodEnd)) { skipped++; continue; }
      const priceNum = config.monthlyPriceUsd ? Number(config.monthlyPriceUsd) : 0;
      if (!priceNum) { skipped++; continue; }
      const grace = config.graceDays ?? 3;
      const dueAt = computeDueAt(issuedAt, grace);
      const nextIssueTs = nextIssuanceTimestampAfter(periodEnd);
      const nextDueAt = computeNextDueAt(nextIssueTs, grace);
      const invoice = this.invRepo.create({
        tenantId: tenant.id,
        periodStart,
        periodEnd,
        amountUsd: priceNum.toFixed(6),
        fxUsdToTenantAtInvoice: null,
        displayCurrencyCode: null,
        status: BillingInvoiceStatus.OPEN,
        issuedAt,
        dueAt,
      });
      try {
        await this.invRepo.save(invoice);
        this.logger.log(`invoice.created tenant=${tenant.id} id=${invoice.id} amount=${invoice.amountUsd}`);
        billingCounters.invoicesCreated();
        subscription.nextDueAt = nextDueAt;
        await this.subRepo.save(subscription);
        created++;
      } catch (e: any) {
        if (e?.code === '23505') { skipped++; continue; }
        this.logger.error(`issueMonthlyInvoices failed tenant=${tenant.id} err=${e?.message}`);
        throw e;
      }
    }
    return { created, skipped };
  }

  async sendReminders(nowUTC: Date): Promise<{ matches: number }> {
    if (!isFeatureEnabled('billingV1')) return { matches: 0 };
    const open = await this.invRepo.find({ where: { status: BillingInvoiceStatus.OPEN } });
    if (!open.length) return { matches: 0 };
    const cfgs = await this.configRepo.find({ where: { tenantId: In([...new Set(open.map(o => o.tenantId))]) } });
    const cfgMap = new Map(cfgs.map(c => [c.tenantId, c]));
    let matches = 0;
    const dayMs = 86400000;
    for (const inv of open) {
      if (!inv.dueAt) continue;
      const cfg = cfgMap.get(inv.tenantId);
      const grace = cfg?.graceDays ?? 3;
      const due = inv.dueAt.getTime();
      const checkpoints = [
        due - 7 * dayMs,
        due,
        due + (grace - 1) * dayMs,
      ];
      if (checkpoints.some(t => Math.abs(t - nowUTC.getTime()) < dayMs / 24)) {
        matches++;
        // TODO notifications
      }
    }
    return { matches };
  }

  async applyEnforcement(nowUTC: Date): Promise<{ suspended: number }> {
    if (!isFeatureEnabled('billingV1')) return { suspended: 0 };
    const open = await this.invRepo.find({ where: { status: BillingInvoiceStatus.OPEN } });
    if (!open.length) return { suspended: 0 };
    const tenantIds = [...new Set(open.map(o => o.tenantId))];
    const cfgs = await this.configRepo.find({ where: { tenantId: In(tenantIds) } });
    const cfgMap = new Map(cfgs.map(c => [c.tenantId, c]));
    const subs = await this.subRepo.find({ where: { tenantId: In(tenantIds) } });
    const subMap = new Map(subs.map(s => [s.tenantId, s]));
    let suspended = 0;
    for (const inv of open) {
      if (!inv.dueAt) continue;
      const cfg = cfgMap.get(inv.tenantId);
      if (!cfg || !cfg.isEnforcementEnabled) continue;
      const grace = cfg.graceDays ?? 3;
      const overdueAt = inv.dueAt.getTime() + grace * 86400000;
      if (nowUTC.getTime() > overdueAt) {
        const sub = subMap.get(inv.tenantId) || await this.getOrCreateSubscription(inv.tenantId);
        if (sub.status !== TenantSubscriptionStatus.SUSPENDED) {
          sub.status = TenantSubscriptionStatus.SUSPENDED;
          sub.suspendAt = nowUTC;
            sub.suspendReason = 'billing_overdue';
          await this.subRepo.save(sub);
          this.logger.log(`enforcement.suspended tenant=${sub.tenantId} invoice=${inv.id}`);
          billingCounters.enforcementSuspended();
          suspended++;
        }
      }
    }
    return { suspended };
  }

  async markPaid(invoiceId: string, depositId: string | null): Promise<BillingInvoice> {
    if (!isFeatureEnabled('billingV1')) throw new BadRequestException('Billing disabled');
    const inv = await this.invRepo.findOne({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const cfg = await this.getOrCreateConfig(inv.tenantId);
    const sub = await this.getOrCreateSubscription(inv.tenantId);
    const nowUTC = new Date();
    inv.status = BillingInvoiceStatus.PAID;
    inv.paidAt = nowUTC;
    if (depositId) inv.depositId = depositId;
    await this.invRepo.save(inv);
    sub.status = TenantSubscriptionStatus.ACTIVE;
    sub.lastPaidAt = nowUTC;
    sub.suspendAt = null;
    sub.suspendReason = null;
    const { periodStart, periodEnd } = buildMonthlyPeriod(nowUTC);
    sub.currentPeriodStart = periodStart;
    sub.currentPeriodEnd = periodEnd;
    const grace = cfg.graceDays ?? 3;
    const nextIssueTs = nextIssuanceTimestampAfter(periodEnd);
    sub.nextDueAt = computeNextDueAt(nextIssueTs, grace);
    await this.subRepo.save(sub);
    return inv;
  }

  async fetchSubscription(tenantId: string) {
    return this.subRepo.findOne({ where: { tenantId } });
  }

  async createBillingDeposit(tenantId: string, userId: string, methodId: string, amountUsd: number, opts: { invoiceId?: string }) {
    if (amountUsd <= 0) throw new UnprocessableEntityException({ code: 'INVALID_AMOUNT', message: 'Amount must be > 0' });
    if (!methodId) throw new UnprocessableEntityException({ code: 'METHOD_REQUIRED', message: 'methodId required' });
    const pmRepo = this.dataSource.getRepository(PaymentMethod);
    const method = await pmRepo.findOne({ where: { id: methodId, tenantId } });
    if (!method) throw new UnprocessableEntityException({ code: 'METHOD_NOT_FOUND', message: 'Payment method not found' });
    return this.dataSource.transaction(async manager => {
      const dep: any = manager.create(Deposit as any, {
        tenantId,
        user_id: userId,
        method_id: methodId,
        originalAmount: amountUsd.toFixed(6),
        originalCurrency: 'USD',
        walletCurrency: 'USD',
        rateUsed: '1',
        convertedAmount: amountUsd.toFixed(6),
        note: opts.invoiceId ? `billing:invoice:${opts.invoiceId}` : 'billing:topup',
        status: 'pending',
      });
      const saved = await manager.save(dep);
      this.logger.log(`deposit.created tenant=${tenantId} deposit=${saved.id} amount=${amountUsd.toFixed(6)} invoice=${opts.invoiceId||'none'}`);
      billingCounters.paymentDeposits();
      return { depositId: saved.id, status: saved.status };
    });
  }

  async computeTenantOverview(tenantId: string, now = new Date()) {
    const sub = await this.getOrCreateSubscription(tenantId);
    const invs = await this.invRepo.find({ where: { tenantId }, order: { issuedAt: 'DESC' }, take: 12 });
    const last = invs[0];
    const open = invs.filter(i => i.status === BillingInvoiceStatus.OPEN);
    const overdueOpen = open.filter(i => i.dueAt && i.dueAt < now);
    const primaryOpen = open[0];
    let daysUntilDue: number | null = null;
    let daysOverdue: number | null = null;
    if (primaryOpen?.dueAt) {
      const diff = primaryOpen.dueAt.getTime() - now.getTime();
      if (diff >= 0) daysUntilDue = Math.ceil(diff / 86400000); else daysOverdue = Math.ceil(Math.abs(diff) / 86400000);
    }
    let currentPeriodProgressPct: number | null = null;
    if (sub.currentPeriodStart && sub.currentPeriodEnd) {
      const startDate = new Date(sub.currentPeriodStart + 'T00:00:00Z');
      const endDate = new Date(sub.currentPeriodEnd + 'T00:00:00Z');
      const span = endDate.getTime() - startDate.getTime();
      const elapsed = now.getTime() - startDate.getTime();
      if (span > 0) currentPeriodProgressPct = Math.min(100, Math.max(0, (elapsed / span) * 100));
    }
    const fmt3 = (v: string | null) => (v == null ? null : Number(v).toFixed(3));
    return {
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      nextDueAt: sub.nextDueAt,
      lastPaidAt: sub.lastPaidAt,
      openInvoiceCount: open.length,
      overdue: overdueOpen.length > 0,
      daysOverdue,
      daysUntilDue,
      currentPeriodProgressPct,
      lastInvoice: last ? {
        id: last.id,
        status: last.status,
        amountUsd: last.amountUsd,
        amountUSD3: fmt3(last.amountUsd),
        issuedAt: last.issuedAt,
        dueAt: last.dueAt,
        paidAt: last.paidAt,
      } : null,
    };
  }

  async listInvoicesFiltered(tenantId: string, opts: { status?: BillingInvoiceStatus; overdue?: boolean; now?: Date }) {
    const { status, overdue, now = new Date() } = opts;
    const where: any = { tenantId }; if (status) where.status = status;
    let list = await this.invRepo.find({ where, order: { issuedAt: 'DESC' } });
    if (overdue) list = list.filter(i => i.status === BillingInvoiceStatus.OPEN && i.dueAt && i.dueAt < now);
    return list;
  }

  async aggregateTenantsForAdmin(params: { status?: string; overdue?: boolean; limit: number; offset: number }) {
    const { status, overdue, limit, offset } = params;
    const subs = await this.subRepo.find();
    const tenantIds = subs.map(s => s.tenantId);
    if (!tenantIds.length) return { items: [], total: 0, limit, offset };
    const tenants = await this.tenantRepo.find({ where: { id: In(tenantIds) } });
    const tm = new Map(tenants.map(t => [t.id, t]));
    const invoices = await this.invRepo.find({ where: { tenantId: In(tenantIds) } });
    const invMap = new Map<string, BillingInvoice[]>();
    for (const inv of invoices) { if (!invMap.has(inv.tenantId)) invMap.set(inv.tenantId, []); invMap.get(inv.tenantId)!.push(inv); }
    let rows = subs.map(s => {
      const invs = (invMap.get(s.tenantId) || []).sort((a,b)=> (b.issuedAt?.getTime()||0)-(a.issuedAt?.getTime()||0));
      const open = invs.filter(i => i.status === BillingInvoiceStatus.OPEN);
      const overdueOpen = open.filter(i => i.dueAt && i.dueAt < new Date());
      const last = invs[0];
      const t: any = tm.get(s.tenantId);
      return {
        tenantId: s.tenantId,
        tenantCode: t?.code || null,
        tenantName: t?.name || null,
        status: s.status,
        nextDueAt: s.nextDueAt,
        lastPaidAt: s.lastPaidAt,
        openInvoices: open.length,
        overdueOpenInvoices: overdueOpen.length,
        lastInvoiceAmountUsd: last?.amountUsd || null,
      };
    });
    if (status) rows = rows.filter(r => r.status === status);
    if (overdue) rows = rows.filter(r => r.overdueOpenInvoices > 0);
    const total = rows.length;
    const boundedLimit = Math.max(1, Math.min(200, limit));
    const safeOffset = Math.max(0, offset);
    const slice = rows.slice(safeOffset, safeOffset + boundedLimit);
    return { items: slice, total, limit: boundedLimit, offset: safeOffset };
  }

  private async getTenantConfigsForBilling(): Promise<Array<{ tenant: Tenant; config: TenantBillingConfig; subscription: TenantSubscription }>> {
    const configs = await this.configRepo.find();
    if (!configs.length) return [];
    const tenantIds = configs.map(c => c.tenantId);
    const tenants = await this.tenantRepo.find({ where: { id: In(tenantIds) } });
    const subs = await this.subRepo.find({ where: { tenantId: In(tenantIds) } });
    const subMap = new Map(subs.map(s => [s.tenantId, s]));
    return tenants.map(t => ({
      tenant: t,
      config: configs.find(c => c.tenantId === t.id)!,
      subscription: subMap.get(t.id) || this.subRepo.create({ tenantId: t.id }),
    }));
  }

  private async upsertSubscriptionDefaults(tenantId: string): Promise<TenantSubscription> {
    let sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub) {
      sub = this.subRepo.create({ tenantId });
      await this.subRepo.save(sub);
    }
    return sub;
  }
}

import { Injectable, NotFoundException, BadRequestException, Logger, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { TenantBillingConfig } from './tenant-billing-config.entity';
import { TenantSubscription, TenantSubscriptionStatus } from './tenant-subscription.entity';
import { BillingInvoice, BillingInvoiceStatus } from './billing-invoice.entity';
import { isFeatureEnabled } from '../common/feature-flags';
import { Tenant } from '../tenants/tenant.entity';
import { Deposit } from '../payments/deposit.entity';
import { PaymentMethod } from '../payments/payment-method.entity';
import { computePeriodAndIssuance, isFirstMonthFree, computeDueAt, computeNextDueAt, nextIssuanceTimestampAfter, buildMonthlyPeriod, toIsoDate } from './billing-utils';
<<<<<<< HEAD
import { billingCounters } from './billing.metrics';
=======
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))

@Injectable()
export class BillingService {
  private readonly logger = new Logger('BillingService');
  constructor(
    @InjectRepository(TenantBillingConfig) private configRepo: Repository<TenantBillingConfig>,
    @InjectRepository(TenantSubscription) private subRepo: Repository<TenantSubscription>,
    @InjectRepository(BillingInvoice) private invRepo: Repository<BillingInvoice>,
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
    @InjectRepository(Deposit) private depositRepo: Repository<Deposit>,
    private dataSource: DataSource,
  ) {}

  ensureBillingEnabled() {
    if (!isFeatureEnabled('billingV1')) throw new BadRequestException('Billing disabled');
  }

  async getOrCreateConfig(tenantId: string): Promise<TenantBillingConfig> {
    let cfg = await this.configRepo.findOne({ where: { tenantId } });
    if (!cfg) {
      cfg = this.configRepo.create({ tenantId, monthlyPriceUsd: null });
      await this.configRepo.save(cfg);
    }
    return cfg;
  }

  async getOrCreateSubscription(tenantId: string): Promise<TenantSubscription> {
    let sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub) {
      sub = this.subRepo.create({ tenantId });
      await this.subRepo.save(sub);
    }
    return sub;
  }

  async listInvoices(tenantId: string, status?: BillingInvoiceStatus): Promise<BillingInvoice[]> {
    const where: any = { tenantId };
    if (status) where.status = status;
    return this.invRepo.find({ where, order: { issuedAt: 'DESC' } });
  }

  async markInvoicePaid(id: string, depositId: string | null) {
    const inv = await this.invRepo.findOne({ where: { id } });
    if (!inv) throw new NotFoundException('Invoice not found');
    inv.status = BillingInvoiceStatus.PAID;
    inv.paidAt = new Date();
    if (depositId) inv.depositId = depositId;
    await this.invRepo.save(inv);
    const sub = await this.getOrCreateSubscription(inv.tenantId);
    sub.status = TenantSubscriptionStatus.ACTIVE;
    sub.lastPaidAt = new Date();
    sub.suspendAt = null; sub.suspendReason = null;
    await this.subRepo.save(sub);
    return inv;
  }

<<<<<<< HEAD
=======
  /* ================== Phase5 Core Public Methods (Feature Flag Protected) ================== */
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))

  /**
   * إصدار الفواتير الشهرية (EOM anchor)
   * - يحسب الفترة (periodStart/periodEnd) ووقت الإصدار issuedAt
   * - يتخطى الشهر الأول (free) أو السعر NULL/0
   * - idempotent بواسطة UNIQUE(tenantId, periodStart, periodEnd)
   * - يحسب dueAt + nextDueAt ويحدّث subscription.nextDueAt
   */
  async issueMonthlyInvoices(nowUTC: Date): Promise<{ created: number; skipped: number }> {
    if (!isFeatureEnabled('billingV1')) return { created: 0, skipped: 0 };
    const { periodStart, periodEnd, issuedAt } = computePeriodAndIssuance(nowUTC);
    const rows = await this.getTenantConfigsForBilling();
    let created = 0, skipped = 0;
    for (const { tenant, config, subscription } of rows) {
      if (isFirstMonthFree(tenant.createdAt, periodStart, periodEnd)) { skipped++; continue; }
      const priceNum = config.monthlyPriceUsd ? Number(config.monthlyPriceUsd) : 0;
      if (!priceNum) { skipped++; continue; }
      const grace = config.graceDays ?? 3;
      const dueAt = computeDueAt(issuedAt, grace);
      const nextIssueTs = nextIssuanceTimestampAfter(periodEnd);
      const nextDueAt = computeNextDueAt(nextIssueTs, grace);
      const invoice = this.invRepo.create({
        tenantId: tenant.id,
        periodStart,
        periodEnd,
        amountUsd: priceNum.toFixed(6),
        fxUsdToTenantAtInvoice: null,
        displayCurrencyCode: null,
        status: BillingInvoiceStatus.OPEN,
        issuedAt,
        dueAt,
      });
      try {
  await this.invRepo.save(invoice);
  this.logger.log(`invoice.created tenant=${tenant.id} id=${invoice.id} amount=${invoice.amountUsd}`);
<<<<<<< HEAD
  billingCounters.invoicesCreated();
=======
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
        subscription.nextDueAt = nextDueAt;
        await this.subRepo.save(subscription);
        created++;
      } catch (e: any) {
        if (e?.code === '23505') { // unique violation idempotent
          skipped++;
          continue;
        }
        this.logger.error(`issueMonthlyInvoices failed tenant=${tenant.id} err=${e?.message}`);
        throw e;
      }
    }
    return { created, skipped };
  }

  /**
   * إرسال تذكيرات (Placeholder): يحسب عدد الفواتير المطابقة لنقاط التذكير
   * dueAt-7d, dueAt, dueAt+(graceDays-1)
   * TODO: notifications لاحقاً
   */
  async sendReminders(nowUTC: Date): Promise<{ matches: number }> {
    if (!isFeatureEnabled('billingV1')) return { matches: 0 };
    const open = await this.invRepo.find({ where: { status: BillingInvoiceStatus.OPEN } });
    if (!open.length) return { matches: 0 };
    const cfgs = await this.configRepo.find({ where: { tenantId: In([...new Set(open.map(o => o.tenantId))]) } });
    const cfgMap = new Map(cfgs.map(c => [c.tenantId, c]));
    let matches = 0;
    const dayMs = 86400000;
    for (const inv of open) {
      if (!inv.dueAt) continue;
      const cfg = cfgMap.get(inv.tenantId);
      const grace = cfg?.graceDays ?? 3;
      const due = inv.dueAt.getTime();
      const checkpoints = [
        due - 7 * dayMs,
        due,
        due + (grace - 1) * dayMs,
      ];
      if (checkpoints.some(t => Math.abs(t - nowUTC.getTime()) < dayMs / 24)) {
        matches++;
        // TODO notifications.enqueue('BILLING_REMINDER', ...)
      }
    }
    return { matches };
  }

  /**
   * فرض الإيقاف: لكل open متأخرة بعد (dueAt + graceDays) و config.isEnforcementEnabled=true
   */
  async applyEnforcement(nowUTC: Date): Promise<{ suspended: number }> {
    if (!isFeatureEnabled('billingV1')) return { suspended: 0 };
    const open = await this.invRepo.find({ where: { status: BillingInvoiceStatus.OPEN } });
    if (!open.length) return { suspended: 0 };
    const tenantIds = [...new Set(open.map(o => o.tenantId))];
    const cfgs = await this.configRepo.find({ where: { tenantId: In(tenantIds) } });
    const cfgMap = new Map(cfgs.map(c => [c.tenantId, c]));
    const subs = await this.subRepo.find({ where: { tenantId: In(tenantIds) } });
    const subMap = new Map(subs.map(s => [s.tenantId, s]));
    let suspended = 0;
    for (const inv of open) {
      if (!inv.dueAt) continue;
      const cfg = cfgMap.get(inv.tenantId);
      if (!cfg || !cfg.isEnforcementEnabled) continue;
      const grace = cfg.graceDays ?? 3;
      const overdueAt = inv.dueAt.getTime() + grace * 86400000;
      if (nowUTC.getTime() > overdueAt) {
        const sub = subMap.get(inv.tenantId) || await this.getOrCreateSubscription(inv.tenantId);
        if (sub.status !== TenantSubscriptionStatus.SUSPENDED) {
          sub.status = TenantSubscriptionStatus.SUSPENDED;
          sub.suspendAt = nowUTC;
          sub.suspendReason = 'billing_overdue';
          await this.subRepo.save(sub);
<<<<<<< HEAD
          this.logger.log(`enforcement.suspended tenant=${sub.tenantId} invoice=${inv.id}`);
          billingCounters.enforcementSuspended();
=======
          this.logger.log(`subscription.suspended tenant=${sub.tenantId} invoice=${inv.id}`);
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
          suspended++;
        }
      }
    }
    return { suspended };
  }

  /**
   * markPaid: تحديث الفاتورة + تفعيل الاشتراك + ضبط الفترات و nextDueAt
   */
  async markPaid(invoiceId: string, depositId: string | null): Promise<BillingInvoice> {
    if (!isFeatureEnabled('billingV1')) throw new BadRequestException('Billing disabled');
    const inv = await this.invRepo.findOne({ where: { id: invoiceId } });
    if (!inv) throw new NotFoundException('Invoice not found');
    const cfg = await this.getOrCreateConfig(inv.tenantId);
    const sub = await this.getOrCreateSubscription(inv.tenantId);
    const nowUTC = new Date();
    inv.status = BillingInvoiceStatus.PAID;
    inv.paidAt = nowUTC;
    if (depositId) inv.depositId = depositId;
    await this.invRepo.save(inv);
    sub.status = TenantSubscriptionStatus.ACTIVE;
    sub.lastPaidAt = nowUTC;
    sub.suspendAt = null;
    sub.suspendReason = null;
    const { periodStart, periodEnd } = buildMonthlyPeriod(nowUTC);
    sub.currentPeriodStart = periodStart;
    sub.currentPeriodEnd = periodEnd;
    const grace = cfg.graceDays ?? 3;
    const nextIssueTs = nextIssuanceTimestampAfter(periodEnd);
    sub.nextDueAt = computeNextDueAt(nextIssueTs, grace);
    await this.subRepo.save(sub);
    return inv;
  }

  /** Fetch subscription without creating (used by BillingGuard lazy hydrate) */
  async fetchSubscription(tenantId: string) {
    return this.subRepo.findOne({ where: { tenantId } });
  }

  /** Create a pending billing deposit (validated payment method + user) */
  async createBillingDeposit(tenantId: string, userId: string, methodId: string, amountUsd: number, opts: { invoiceId?: string }) {
    if (amountUsd <= 0) throw new UnprocessableEntityException({ code: 'INVALID_AMOUNT', message: 'Amount must be > 0' });
    if (!methodId) throw new UnprocessableEntityException({ code: 'METHOD_REQUIRED', message: 'methodId required' });
    const pmRepo = this.dataSource.getRepository(PaymentMethod);
    const method = await pmRepo.findOne({ where: { id: methodId, tenantId } });
    if (!method) throw new UnprocessableEntityException({ code: 'METHOD_NOT_FOUND', message: 'Payment method not found' });
    return this.dataSource.transaction(async manager => {
      const dep: any = manager.create(Deposit as any, {
        tenantId,
        user_id: userId,
        method_id: methodId,
        originalAmount: amountUsd.toFixed(6),
        originalCurrency: 'USD',
        walletCurrency: 'USD',
        rateUsed: '1',
        convertedAmount: amountUsd.toFixed(6),
        note: opts.invoiceId ? `billing:invoice:${opts.invoiceId}` : 'billing:topup',
        status: 'pending',
      });
      const saved = await manager.save(dep);
  this.logger.log(`deposit.created tenant=${tenantId} deposit=${saved.id} amount=${amountUsd.toFixed(6)} invoice=${opts.invoiceId||'none'}`);
<<<<<<< HEAD
  billingCounters.paymentDeposits();
=======
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))
      return { depositId: saved.id, status: saved.status };
    });
  }

  /** Extended overview */
  async computeTenantOverview(tenantId: string, now = new Date()) {
    const sub = await this.getOrCreateSubscription(tenantId);
    const invs = await this.invRepo.find({ where: { tenantId }, order: { issuedAt: 'DESC' }, take: 12 });
    const last = invs[0];
    const open = invs.filter(i => i.status === BillingInvoiceStatus.OPEN);
    const overdueOpen = open.filter(i => i.dueAt && i.dueAt < now);
    const primaryOpen = open[0];
    let daysUntilDue: number | null = null;
    let daysOverdue: number | null = null;
    if (primaryOpen?.dueAt) {
      const diff = primaryOpen.dueAt.getTime() - now.getTime();
      if (diff >= 0) daysUntilDue = Math.ceil(diff / 86400000); else daysOverdue = Math.ceil(Math.abs(diff) / 86400000);
    }
    let currentPeriodProgressPct: number | null = null;
    if (sub.currentPeriodStart && sub.currentPeriodEnd) {
      const startDate = new Date(sub.currentPeriodStart + 'T00:00:00Z');
      const endDate = new Date(sub.currentPeriodEnd + 'T00:00:00Z');
      const span = endDate.getTime() - startDate.getTime();
      const elapsed = now.getTime() - startDate.getTime();
      if (span > 0) currentPeriodProgressPct = Math.min(100, Math.max(0, (elapsed / span) * 100));
    }
    const fmt3 = (v: string | null) => (v == null ? null : Number(v).toFixed(3));
    return {
      status: sub.status,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      nextDueAt: sub.nextDueAt,
      lastPaidAt: sub.lastPaidAt,
      openInvoiceCount: open.length,
      overdue: overdueOpen.length > 0,
      daysOverdue,
      daysUntilDue,
      currentPeriodProgressPct,
      lastInvoice: last ? {
        id: last.id,
        status: last.status,
        amountUsd: last.amountUsd,
        amountUSD3: fmt3(last.amountUsd),
        issuedAt: last.issuedAt,
        dueAt: last.dueAt,
        paidAt: last.paidAt,
      } : null,
    };
  }

  async listInvoicesFiltered(tenantId: string, opts: { status?: BillingInvoiceStatus; overdue?: boolean; now?: Date }) {
    const { status, overdue, now = new Date() } = opts;
    const where: any = { tenantId }; if (status) where.status = status;
    let list = await this.invRepo.find({ where, order: { issuedAt: 'DESC' } });
    if (overdue) list = list.filter(i => i.status === BillingInvoiceStatus.OPEN && i.dueAt && i.dueAt < now);
    return list;
  }

  async aggregateTenantsForAdmin(params: { status?: string; overdue?: boolean; limit: number; offset: number }) {
    const { status, overdue, limit, offset } = params;
    const subs = await this.subRepo.find();
    const tenantIds = subs.map(s => s.tenantId);
    if (!tenantIds.length) return { items: [], total: 0, limit, offset };
    const tenants = await this.tenantRepo.find({ where: { id: In(tenantIds) } });
    const tm = new Map(tenants.map(t => [t.id, t]));
    const invoices = await this.invRepo.find({ where: { tenantId: In(tenantIds) } });
    const invMap = new Map<string, BillingInvoice[]>();
    for (const inv of invoices) { if (!invMap.has(inv.tenantId)) invMap.set(inv.tenantId, []); invMap.get(inv.tenantId)!.push(inv); }
    let rows = subs.map(s => {
      const invs = (invMap.get(s.tenantId) || []).sort((a,b)=> (b.issuedAt?.getTime()||0)-(a.issuedAt?.getTime()||0));
      const open = invs.filter(i => i.status === BillingInvoiceStatus.OPEN);
      const overdueOpen = open.filter(i => i.dueAt && i.dueAt < new Date());
      const last = invs[0];
      const t: any = tm.get(s.tenantId);
      return {
        tenantId: s.tenantId,
        tenantCode: t?.code || null,
        tenantName: t?.name || null,
        status: s.status,
        nextDueAt: s.nextDueAt,
        lastPaidAt: s.lastPaidAt,
        openInvoices: open.length,
        overdueOpenInvoices: overdueOpen.length,
        lastInvoiceAmountUsd: last?.amountUsd || null,
      };
    });
    if (status) rows = rows.filter(r => r.status === status);
    if (overdue) rows = rows.filter(r => r.overdueOpenInvoices > 0);
    const total = rows.length;
    const boundedLimit = Math.max(1, Math.min(200, limit));
    const safeOffset = Math.max(0, offset);
    const slice = rows.slice(safeOffset, safeOffset + boundedLimit);
    return { items: slice, total, limit: boundedLimit, offset: safeOffset };
  }

<<<<<<< HEAD
=======
  /* ================== Private Helpers ================== */
>>>>>>> 324b834 (Phase 5 — Billing V1 (subscriptions, invoices, guard, APIs, tests, docs, flag) (#1))

  /** جلب المتاجر مع configs والاشتراك (بدون تصفية إضافية حالياً) */
  private async getTenantConfigsForBilling(): Promise<Array<{ tenant: Tenant; config: TenantBillingConfig; subscription: TenantSubscription }>> {
    const configs = await this.configRepo.find();
    if (!configs.length) return [];
    const tenantIds = configs.map(c => c.tenantId);
    const tenants = await this.tenantRepo.find({ where: { id: In(tenantIds) } });
    const subs = await this.subRepo.find({ where: { tenantId: In(tenantIds) } });
    const subMap = new Map(subs.map(s => [s.tenantId, s]));
    return tenants.map(t => ({
      tenant: t,
      config: configs.find(c => c.tenantId === t.id)!,
      subscription: subMap.get(t.id) || this.subRepo.create({ tenantId: t.id }),
    }));
  }

  /** ضمان وجود اشتراك افتراضي */
  private async upsertSubscriptionDefaults(tenantId: string): Promise<TenantSubscription> {
    let sub = await this.subRepo.findOne({ where: { tenantId } });
    if (!sub) {
      sub = this.subRepo.create({ tenantId });
      await this.subRepo.save(sub);
    }
    return sub;
  }
}
