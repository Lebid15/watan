import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BillingService } from './billing.service';
import { isFeatureEnabled } from '../common/feature-flags';

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

  constructor(private billing: BillingService) {}

  private async withLock(key: string, fn: () => Promise<void>) {
    if (!BillingJobLocks.tryAcquire(key)) {
      this.logger.warn(`[lock] skip job=${key}`);
      return;
    }
    try { await fn(); } finally { BillingJobLocks.release(key); }
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
}
