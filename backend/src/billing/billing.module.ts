import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantBillingConfig } from './tenant-billing-config.entity';
import { TenantSubscription } from './tenant-subscription.entity';
import { BillingInvoice } from './billing-invoice.entity';
import { Tenant } from '../tenants/tenant.entity';
import { BillingService } from './billing.service';
import { Deposit } from '../payments/deposit.entity';
import { BillingSchedulers } from './billing.schedulers';
import { TenantBillingController } from './tenant-billing.controller';
import { AdminBillingController } from './tenant-billing.admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TenantBillingConfig, TenantSubscription, BillingInvoice, Tenant, Deposit])],
  providers: [BillingService, BillingSchedulers],
  controllers: [TenantBillingController, AdminBillingController],
  exports: [BillingService],
})
export class BillingModule {}
