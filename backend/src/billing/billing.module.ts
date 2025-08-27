import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantBillingConfig } from './tenant-billing-config.entity';
import { TenantSubscription } from './tenant-subscription.entity';
import { BillingInvoice } from './billing-invoice.entity';
import { Tenant } from '../tenants/tenant.entity';
import { BillingService } from './billing.service';
import { BillingIssueScheduler } from './schedulers/billing-issue.scheduler';
import { BillingEnforcementScheduler } from './schedulers/billing-enforcement.scheduler';
import { BillingReminderScheduler } from './schedulers/billing-reminder.scheduler';
import { TenantBillingController } from './tenant-billing.controller';
import { AdminBillingController } from './tenant-billing.admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TenantBillingConfig, TenantSubscription, BillingInvoice, Tenant])],
  providers: [BillingService, BillingIssueScheduler, BillingEnforcementScheduler, BillingReminderScheduler],
  controllers: [TenantBillingController, AdminBillingController],
  exports: [BillingService],
})
export class BillingModule {}
