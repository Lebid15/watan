import { Controller, Get, Query, Param, Patch, Body, Post, NotFoundException, ConflictException, ForbiddenException, Req } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingInvoiceStatus } from './billing-invoice.entity';
import { isFeatureEnabled } from '../common/feature-flags';
import { BillingSchedulers } from './billing.schedulers';

@Controller('admin/billing')
export class AdminBillingController {
  constructor(private svc: BillingService, private sched: BillingSchedulers) {}

  @Get('tenants')
  async tenants(@Req() req: any, @Query('status') status?: string, @Query('overdue') overdue?: string, @Query('limit') limit='20', @Query('offset') offset='0') {
    this.assertInstanceOwner(req);
    const lim = Math.max(1, Math.min(200, Number(limit) || 20));
    const off = Math.max(0, Number(offset) || 0);
    return this.svc.aggregateTenantsForAdmin({ status, overdue: overdue==='true', limit: lim, offset: off });
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
  async patchConfig(@Req() req: any, @Param('tenantId') tenantId: string, @Body() body: any) {
    this.assertInstanceOwner(req);
    const cfg = await this.svc.getOrCreateConfig(tenantId);
    if (body.monthlyPriceUsd !== undefined) cfg.monthlyPriceUsd = body.monthlyPriceUsd;
    if (body.graceDays !== undefined) cfg.graceDays = body.graceDays;
    if (body.isEnforcementEnabled !== undefined) cfg.isEnforcementEnabled = body.isEnforcementEnabled;
    await (this as any).svc['configRepo'].save(cfg); // quick persistence; refactor later
    return cfg;
  }

  @Get('tenants/:tenantId/invoices')
  async tenantInvoices(@Req() req: any, @Param('tenantId') tenantId: string, @Query('status') status?: BillingInvoiceStatus, @Query('overdue') overdue?: string) {
    this.assertInstanceOwner(req);
    const list = await this.svc.listInvoicesFiltered(tenantId, { status, overdue: overdue==='true' });
    return { items: list.map(i => ({ id: i.id, status: i.status, amountUsd: i.amountUsd, amountUSD3: Number(i.amountUsd).toFixed(3), periodStart: i.periodStart, periodEnd: i.periodEnd, dueAt: i.dueAt, issuedAt: i.issuedAt, paidAt: i.paidAt })) };
  }

  private assertInstanceOwner(req: any) {
    const role = req.user?.roleFinal || req.user?.role;
    if (role !== 'instance_owner') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'FORBIDDEN' });
  }
}
