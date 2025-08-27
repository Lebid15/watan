import { Controller, Get, Query, Param, Patch, Body, Post, NotFoundException, ConflictException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingInvoiceStatus } from './billing-invoice.entity';
import { isFeatureEnabled } from '../common/feature-flags';
import { BillingSchedulers } from './billing.schedulers';

@Controller('api/admin/billing')
export class AdminBillingController {
  constructor(private svc: BillingService, private sched: BillingSchedulers) {}

  @Get('tenants')
  async tenants(@Query('status') _status?: string) {
    // Placeholder: would aggregate subscriptions + overdue detection
    return { items: [] };
  }

  @Post('invoices/:id/mark-paid')
  async markPaid(@Param('id') id: string, @Body() body: any) {
    const inv = await this.svc.markInvoicePaid(id, body.depositId || null);
    return { id: inv.id, status: inv.status, paidAt: inv.paidAt };
  }

  /**
   * Manual issuance trigger (staging only)
   * POST /api/admin/billing/manual-issue?tenantId=...
   * - Behind billingV1
   * - Lock-aware (409 if running)
   * - tenantId reserved (TODO targeted issuance)
   */
  @Post('manual-issue')
  async manualIssue(@Query('tenantId') _tenantId?: string) {
    if (!isFeatureEnabled('billingV1')) throw new NotFoundException();
    if (process.env.NODE_ENV !== 'staging') throw new NotFoundException();
    if (this.sched.isIssueLocked()) throw new ConflictException('issue job locked');
    const res = await this.sched.manualIssue(new Date());
    return { created: res.created, skipped: res.skipped, locked: res.locked };
  }

  @Patch('config/:tenantId')
  async patchConfig(@Param('tenantId') tenantId: string, @Body() body: any) {
    const cfg = await this.svc.getOrCreateConfig(tenantId);
    if (body.monthlyPriceUsd !== undefined) cfg.monthlyPriceUsd = body.monthlyPriceUsd;
    if (body.graceDays !== undefined) cfg.graceDays = body.graceDays;
    if (body.isEnforcementEnabled !== undefined) cfg.isEnforcementEnabled = body.isEnforcementEnabled;
  await (this as any).svc['configRepo'].save(cfg); // quick persistence; refactor later
  return cfg;
  }
}
