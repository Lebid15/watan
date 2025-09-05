import { Controller, Get, Req, UseGuards, UseFilters } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClientApiAuthGuard } from './client-auth.guard';
import { ClientApiExceptionFilter } from './client-api-exception.filter';

@ApiTags('Client API')
@Controller('/account/api')
@UseGuards(ClientApiAuthGuard)
@UseFilters(ClientApiExceptionFilter)
export class ClientApiAccountController {
  @Get()
  status(@Req() req: any) {
    const u = req.clientApiUser;
    return {
      enabled: !!u?.apiEnabled,
      lastUsedAt: u?.apiLastUsedAt || null,
      rateLimitPerMin: u?.apiRateLimitPerMin || null,
    };
  }
}
