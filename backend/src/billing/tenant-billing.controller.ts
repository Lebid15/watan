import { Controller, Get, Query, Post, Body, Req, UnprocessableEntityException, ForbiddenException, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { BillingInvoiceStatus } from './billing-invoice.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

function format3(v: string | null | undefined) { if (v==null) return null; return Number(v).toFixed(3); }

@UseGuards(JwtAuthGuard)
@Controller('tenant/billing')
export class TenantBillingController {
  constructor(private svc: BillingService) {}

  @Get('overview')
  async overview(@Req() req: any) {
    const tenantId = req.tenant?.id || req.user?.tenantId;
    this.assertTenantOwner(req);
    return this.svc.computeTenantOverview(tenantId);
  }

  @Get('invoices')
  async invoices(@Req() req: any, @Query('status') status?: BillingInvoiceStatus, @Query('overdue') overdue?: string) {
    const tenantId = req.tenant?.id || req.user?.tenantId;
    this.assertTenantOwner(req);
    const list = await this.svc.listInvoicesFiltered(tenantId, { status, overdue: overdue==='true' });
    return { items: list.map(i => ({ id: i.id, status: i.status, amountUsd: i.amountUsd, amountUSD3: format3(i.amountUsd), periodStart: i.periodStart, periodEnd: i.periodEnd, issuedAt: i.issuedAt, dueAt: i.dueAt, paidAt: i.paidAt })) };
  }

  @Post('payments/request')
  async requestPayment(@Req() req: any, @Body() body: any) {
    this.assertTenantOwner(req);
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const amountUsd = Number(body.amountUsd);
    const invoiceId = body.invoiceId || undefined;
    const methodId = body.methodId;
    if (!amountUsd || amountUsd <= 0) throw new UnprocessableEntityException({ code: 'INVALID_AMOUNT', message: 'Amount must be > 0' });
    if (!methodId) throw new UnprocessableEntityException({ code: 'METHOD_REQUIRED', message: 'methodId required' });
    if (invoiceId) {
      const openInvs = await this.svc.listInvoicesFiltered(tenantId, { status: BillingInvoiceStatus.OPEN });
      if (!openInvs.some(i => i.id === invoiceId)) throw new UnprocessableEntityException({ code: 'INVOICE_NOT_OPEN', message: 'Invoice is not open' });
    }
    const dep = await this.svc.createBillingDeposit(tenantId, req.user.id, methodId, amountUsd, { invoiceId });
    return { depositId: dep.depositId, status: dep.status, invoiceId: invoiceId || null };
  }

  private assertTenantOwner(req: any) {
    const role = req.user?.roleFinal || req.user?.role;
    // TEMP DEBUG
    if (process.env.BILLING_TEST_DEBUG === '1') {
      // eslint-disable-next-line no-console
      console.log('[BILLING][assertTenantOwner] roleFinal=%s rawRole=%s userId=%s', req.user?.roleFinal, req.user?.role, req.user?.id);
    }
    if (role !== 'tenant_owner') throw new ForbiddenException({ code: 'FORBIDDEN', message: 'FORBIDDEN' });
  }
}
