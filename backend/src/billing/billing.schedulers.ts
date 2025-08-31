import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingService } from './billing.service';
import { isFeatureEnabled } from '../common/feature-flags';
import { billingGauges, observeJobDuration } from './billing.metrics';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BillingInvoice, BillingInvoiceStatus } from './billing-invoice.entity';
import { TenantSubscription, TenantSubscriptionStatus } from './tenant-subscription.entity';

let Redis: any; try { Redis = require('ioredis'); } catch {}

// Simple in-memory lock (process-level). For multi-instance deployment, replace with distributed lock (e.g., Redis).
class BillingJobLocks {
  private static locks = new Set<string>();
  static tryAcquire(key: string): boolean {
    if (this.locks.has(key)) return false;
    this.locks.add(key); return true;
  }
  static release(key: string) { this.locks.delete(key); }
  static isLocked(key: string) { return this.locks.has(key); }
}

@Injectable()
export class BillingSchedulers {
  private readonly logger = new Logger('BillingSchedulers');
  private readonly ISSUE_KEY = 'billing:issue';
  private readonly REMIND_KEY = 'billing:reminders';
  private readonly ENFORCE_KEY = 'billing:enforcement';
  private redis: any = null;
  private lastIssueAt: Date | null = null;
  private lastEnforceAt: Date | null = null;
  private lastRemindAt: Date | null = null;

  constructor(
    private billing: BillingService,
    @InjectRepository(BillingInvoice) private invRepo: Repository<BillingInvoice>,
    @InjectRepository(TenantSubscription) private subRepo: Repository<TenantSubscription>,
  ) {
    const url = process.env.REDIS_URL;
    if (url && Redis) {
      this.redis = new Redis(url, { lazyConnect: true });
      this.redis.on('error', (e: any) => this.logger.warn('Redis error: ' + e?.message));
      this.redis.connect().catch(()=>{});
    }
  }

  private async acquireDistLock(key: string, ttlMs: number): Promise<boolean> {
    if (this.redis) {
      // SET key value NX PX ttl
      const ok = await this.redis.set(`billing:lock:${key}`, '1', 'PX', ttlMs, 'NX');
      if (!ok) return false;
      return true;
    }
    return BillingJobLocks.tryAcquire(key);
  }
  private async releaseDistLock(key: string) {
    if (this.redis) { await this.redis.del(`billing:lock:${key}`); return; }
    BillingJobLocks.release(key);
  }
  private async withLock(key: string, ttlMs: number, jobName: string, fn: () => Promise<void>) {
    const start = Date.now();
    const acquired = await this.acquireDistLock(key, ttlMs);
    if (!acquired) {
      this.logger.log(`job_skipped_locked job=${jobName}`);
      return;
    }
    try { await fn(); } finally {
      await this.releaseDistLock(key);
      const dur = (Date.now()-start)/1000;
      observeJobDuration(jobName, dur);
      await this.refreshGauges();
      this.logger.log(`job.summary job=${jobName} duration_ms=${Math.round(dur*1000)}`);
    }
  }
  private async refreshGauges() {
    try {
      const open = await this.invRepo.count({ where: { status: BillingInvoiceStatus.OPEN } });
      const suspended = await this.subRepo.count({ where: { status: TenantSubscriptionStatus.SUSPENDED } });
      billingGauges.openInvoices(open);
      billingGauges.suspendedTenants(suspended);
    } catch {}
  }

  // Daily 23:55 UTC, internally check for last day of month (since "L" unsupported in node-cron)
  @Cron('0 55 23 * * *', { timeZone: 'UTC' })
  async cronIssueMonthly() {
    if (!isFeatureEnabled('billingV1')) return;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    if (tomorrow.getUTCDate() !== 1) return; // not last day-of-month
    await this.withLock(this.ISSUE_KEY, async () => {
      const res = await this.billing.issueMonthlyInvoices(now);
      this.logger.log(`[billing][issue] created=${res.created} skipped=${res.skipped} at=${now.toISOString()}`);
      this.lastIssueAt = new Date();
      if (this.redis) await this.redis.set('billing:last_run:issue', this.lastIssueAt.toISOString(), 'PX', 6*60*60*1000);
    });
  }

  // Daily enforcement 00:10 UTC
  @Cron('0 10 0 * * *', { timeZone: 'UTC' })
  async cronEnforce() {
    if (!isFeatureEnabled('billingV1')) return;
    await this.withLock(this.ENFORCE_KEY, async () => {
      const now = new Date();
      const res = await this.billing.applyEnforcement(now);
      this.logger.log(`[billing][enforce] suspended=${res.suspended} at=${now.toISOString()}`);
      this.lastEnforceAt = new Date();
      if (this.redis) await this.redis.set('billing:last_run:enforce', this.lastEnforceAt.toISOString(), 'PX', 6*60*60*1000);
    });
  }

  // Daily reminders 08:00 UTC
  @Cron('0 0 8 * * *', { timeZone: 'UTC' })
  async cronReminders() {
    if (!isFeatureEnabled('billingV1')) return;
    await this.withLock(this.REMIND_KEY, async () => {
      const now = new Date();
      const res = await this.billing.sendReminders(now);
      this.logger.log(`[billing][reminders] matches=${res.matches} at=${now.toISOString()}`);
      this.lastRemindAt = new Date();
      if (this.redis) await this.redis.set('billing:last_run:remind', this.lastRemindAt.toISOString(), 'PX', 6*60*60*1000);
    });
  }

  // Manual trigger support
  isIssueLocked() { return BillingJobLocks.isLocked(this.ISSUE_KEY); }
  async manualIssue(now = new Date()) {
    if (!isFeatureEnabled('billingV1')) return { created: 0, skipped: 0, locked: false };
    if (!BillingJobLocks.tryAcquire(this.ISSUE_KEY)) {
      return { created: 0, skipped: 0, locked: true };
    }
    try {
      const res = await this.billing.issueMonthlyInvoices(now);
      return { ...res, locked: false };
    } finally {
      BillingJobLocks.release(this.ISSUE_KEY);
    }
  }

  getLastRuns() {
    return { issue: this.lastIssueAt, enforce: this.lastEnforceAt, remind: this.lastRemindAt };
  }

  async onModuleDestroy() {
    if (this.redis) {
      try { await this.redis.quit(); } catch {}
    }
  }
}

// (duplicate import block removed)

// Simple in-memory lock (process-level). For multi-instance deployment, replace with distributed lock (e.g., Redis).
class BillingJobLocks {
  private static locks = new Set<string>();
  static tryAcquire(key: string): boolean {
    if (this.locks.has(key)) return false;
    this.locks.add(key); return true;
  }
  static release(key: string) { this.locks.delete(key); }
  static isLocked(key: string) { return this.locks.has(key); }
}

@Injectable()
export class BillingSchedulers implements OnModuleDestroy {
  private readonly logger = new Logger('BillingSchedulers');
  private readonly ISSUE_KEY = 'billing:issue';
  private readonly REMIND_KEY = 'billing:reminders';
  private readonly ENFORCE_KEY = 'billing:enforcement';
  private redis: any = null;
  private lastIssueAt: Date | null = null;
  private lastEnforceAt: Date | null = null;
  private lastRemindAt: Date | null = null;
// (duplicate class header artifacts removed)

  constructor(
    private billing: BillingService,
    @InjectRepository(BillingInvoice) private invRepo: Repository<BillingInvoice>,
    @InjectRepository(TenantSubscription) private subRepo: Repository<TenantSubscription>,
  ) {
    const url = process.env.REDIS_URL;
    if (url && Redis) {
      this.redis = new Redis(url, { lazyConnect: true });
      this.redis.on('error', (e: any) => this.logger.warn('Redis error: ' + e?.message));
      this.redis.connect().catch(()=>{});
    }
  }

  private async acquireDistLock(key: string, ttlMs: number): Promise<boolean> {
    if (this.redis) {
      // SET key value NX PX ttl
      const ok = await this.redis.set(`billing:lock:${key}`, '1', 'PX', ttlMs, 'NX');
      if (!ok) return false;
      return true;
    }
    return BillingJobLocks.tryAcquire(key);
  }
  private async releaseDistLock(key: string) {
    if (this.redis) { await this.redis.del(`billing:lock:${key}`); return; }
    BillingJobLocks.release(key);
  }
  private async withLock(key: string, ttlMs: number, jobName: string, fn: () => Promise<void>) {
    const start = Date.now();
    const acquired = await this.acquireDistLock(key, ttlMs);
    if (!acquired) {
      this.logger.log(`job_skipped_locked job=${jobName}`);
      return;
    }
    try { await fn(); } finally {
      await this.releaseDistLock(key);
      const dur = (Date.now()-start)/1000;
      observeJobDuration(jobName, dur);
      await this.refreshGauges();
      this.logger.log(`job.summary job=${jobName} duration_ms=${Math.round(dur*1000)}`);
    }
  }
  private async refreshGauges() {
    try {
      const open = await this.invRepo.count({ where: { status: BillingInvoiceStatus.OPEN } });
      const suspended = await this.subRepo.count({ where: { status: TenantSubscriptionStatus.SUSPENDED } });
      billingGauges.openInvoices(open);
      billingGauges.suspendedTenants(suspended);
    } catch {}
  }

  // Daily 23:55 UTC, internally check for last day of month (since "L" unsupported in node-cron)
  @Cron('0 55 23 * * *', { timeZone: 'UTC' })
  async cronIssueMonthly() {
    if (!isFeatureEnabled('billingV1')) return;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    if (tomorrow.getUTCDate() !== 1) return; // not last day-of-month
    await this.withLock(this.ISSUE_KEY, 5*60_000, 'issue', async () => {
      const res = await this.billing.issueMonthlyInvoices(now);
      this.logger.log(`[billing][issue] created=${res.created} skipped=${res.skipped} at=${now.toISOString()}`);
      this.lastIssueAt = new Date();
      if (this.redis) await this.redis.set('billing:last_run:issue', this.lastIssueAt.toISOString(), 'PX', 6*60*60*1000);
    });
  }

  // Daily enforcement 00:10 UTC
  @Cron('0 10 0 * * *', { timeZone: 'UTC' })
  async cronEnforce() {
    if (!isFeatureEnabled('billingV1')) return;
    await this.withLock(this.ENFORCE_KEY, 15*60_000, 'enforce', async () => {
      const now = new Date();
      const res = await this.billing.applyEnforcement(now);
      this.logger.log(`[billing][enforce] suspended=${res.suspended} at=${now.toISOString()}`);
      this.lastEnforceAt = new Date();
      if (this.redis) await this.redis.set('billing:last_run:enforce', this.lastEnforceAt.toISOString(), 'PX', 6*60*60*1000);
    });
  }

  // Daily reminders 08:00 UTC
  @Cron('0 0 8 * * *', { timeZone: 'UTC' })
  async cronReminders() {
    if (!isFeatureEnabled('billingV1')) return;
    await this.withLock(this.REMIND_KEY, 5*60_000, 'remind', async () => {
      const now = new Date();
      const res = await this.billing.sendReminders(now);
      this.logger.log(`[billing][reminders] matches=${res.matches} at=${now.toISOString()}`);
      this.lastRemindAt = new Date();
      if (this.redis) await this.redis.set('billing:last_run:remind', this.lastRemindAt.toISOString(), 'PX', 6*60*60*1000);
    });
  }

  // Manual trigger support
  isIssueLocked() { return BillingJobLocks.isLocked(this.ISSUE_KEY); }
  async manualIssue(now = new Date()) {
    if (!isFeatureEnabled('billingV1')) return { created: 0, skipped: 0, locked: false };
    const locked = !(await this.acquireDistLock(this.ISSUE_KEY, 60_000));
    if (locked) return { created: 0, skipped: 0, locked: true };
    try {
      const res = await this.billing.issueMonthlyInvoices(now);
      return { ...res, locked: false };
    } finally {
      await this.releaseDistLock(this.ISSUE_KEY);
    }
  }

  getLastRuns() {
    return { issue: this.lastIssueAt, enforce: this.lastEnforceAt, remind: this.lastRemindAt };
  }

  async onModuleDestroy() {
    if (this.redis) {
      try { await this.redis.quit(); } catch {}
    }
    }
  }
}
