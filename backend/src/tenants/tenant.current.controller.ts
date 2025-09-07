import { Controller, Get, Req } from '@nestjs/common';

@Controller('tenant')
export class TenantCurrentController {
  @Get('current')
  getCurrent(@Req() req: any) {
    const tenant = req.tenant || null;
    return {
      tenantId: tenant ? tenant.id : null,
      tenantCode: tenant ? (tenant as any).code : null,
      hostUsed: req.headers['x-tenant-host'] || req.headers.host || null,
      origin: req.headers.origin || null,
      domainMatched: !!tenant,
    };
  }
}
