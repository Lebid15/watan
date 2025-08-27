import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TenantBillingConfig } from './tenant-billing-config.entity';
import { TenantSubscription, TenantSubscriptionStatus } from './tenant-subscription.entity';
import { BillingInvoice, BillingInvoiceStatus } from './billing-invoice.entity';
import { isFeatureEnabled } from '../common/feature-flags';
import { Tenant } from '../tenants/tenant.entity';
import { computePeriodAndIssuance, isFirstMonthFree, computeDueAt, computeNextDueAt, nextIssuanceTimestampAfter, buildMonthlyPeriod, toIsoDate } from './billing-utils';

@Injectable()
export class BillingService {
  private readonly logger = new Logger('BillingService');
  constructor(
    @InjectRepository(TenantBillingConfig) private configRepo: Repository<TenantBillingConfig>,
    @InjectRepository(TenantSubscription) private subRepo: Repository<TenantSubscription>,
    @InjectRepository(BillingInvoice) private invRepo: Repository<BillingInvoice>,
    @InjectRepository(Tenant) private tenantRepo: Repository<Tenant>,
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

  /* ================== Private Helpers ================== */

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
