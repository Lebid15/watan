import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { DistributorPricingService } from './distributor-pricing.service';
import { FinalRoles } from '../common/authz/roles';
import { isFeatureEnabled } from '../common/feature-flags';

@Controller('tenant/distributor/pricing')
@FinalRoles('instance_owner')
export class DistributorPricingController {
  constructor(private readonly svc: DistributorPricingService) {}

  private ctx(req: any) { return { tenantId: req?.tenant?.id || req?.user?.tenantId, distributorUserId: req?.user?.id }; }

  @Get('groups')
  async listGroups(@Req() req: any) { if (!isFeatureEnabled('catalogLinking')) return { items: [] }; const { tenantId, distributorUserId } = this.ctx(req); return this.svc.listGroups(tenantId, distributorUserId); }

  @Post('groups')
  async createGroup(@Req() req: any, @Body('name') name: string) { const { tenantId, distributorUserId } = this.ctx(req); return this.svc.createGroup(tenantId, distributorUserId, name); }

  @Post('attach-user')
  async attach(@Body('groupId') groupId: string, @Body('userId') userId: string) { return this.svc.attachUser(groupId, userId); }

  @Post('detach-user')
  async detach(@Body('groupId') groupId: string, @Body('userId') userId: string) { return this.svc.detachUser(groupId, userId); }

  @Post('set-price')
  async setPrice(@Req() req: any, @Body() body: any) { const { tenantId, distributorUserId } = this.ctx(req); return this.svc.setPackagePrice(tenantId, distributorUserId, body.groupId, body.packageId, Number(body.priceUSD||0)); }

  @Get('table')
  async table(@Req() req: any) { const { tenantId, distributorUserId } = this.ctx(req); return this.svc.listPricingTable(tenantId, distributorUserId); }
}
