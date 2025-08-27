import { Controller, Get, UseGuards, Req, UseInterceptors } from '@nestjs/common';
import { ExternalAuthGuard } from './external-auth.guard';
import { Scopes } from './scopes.decorator';
import { ExternalRateLimitInterceptor } from './external-rate-limit.interceptor';
import { format3 } from '../common/money/money.util';

@Controller('/api/tenant/external/v1')
@UseGuards(ExternalAuthGuard)
@UseInterceptors(ExternalRateLimitInterceptor)
export class ExternalPublicController {
  @Get('ping')
  @Scopes('ping')
  ping(@Req() req: any) {
    return { ok: true, time: new Date().toISOString(), tenantId: req.externalToken.tenantId, userId: req.externalToken.userId };
  }

  @Get('wallet/balance')
  @Scopes('wallet.balance')
  balance(@Req() req: any) {
    const user = req.user;
    const bal = Number(user.balance) || 0;
    return { balanceUSD3: format3(bal), currency: 'USD' };
  }
}
