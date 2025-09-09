import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards, UseFilters } from '@nestjs/common';
import { debugEnabled, debugLog } from '../common/debug.util';
import { ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { ClientApiAuthGuard } from './client-auth.guard';
import { ClientApiService } from './client-api.service';
import { ClientApiExceptionFilter } from './client-api-exception.filter';

@ApiTags('Client API')
@Controller('/client/api')
@UseGuards(ClientApiAuthGuard)
@UseFilters(ClientApiExceptionFilter)
export class ClientApiController {
  constructor(private service: ClientApiService) {}

  // openapi.json now served publicly via separate controller

  @Get('profile')
  profile(@Req() req: any, @Res({ passthrough: true }) res: any) {
    try {
      const reqId = (req.headers['x-request-id'] as string) || Math.random().toString(36).slice(2,8);
      req.reqId = reqId;
      try { res?.set?.('x-req-id', reqId); } catch {}
      const host = (req.headers['host'] as string) || '';
      if (debugEnabled('clientApiProfile')) debugLog('clientApiProfile', 'begin', {
        reqId,
        host,
        tenantId: req.tenant?.id || null,
        tokenHash8: req.clientApiTokenHash8 || null,
        tokenLen: req.clientApiTokenLen || null,
        path: req.originalUrl || req.url,
      });
      const u = req.clientApiUser;
      if (!u) throw new Error('profile_missing_user_ctx');
      // Normalize balance (TypeORM decimal => string sometimes)
      const rawBal: any = u.balance;
      let balanceNum: number;
      if (typeof rawBal === 'number') balanceNum = rawBal;
      else if (rawBal === null || rawBal === undefined || rawBal === '') balanceNum = 0;
      else {
        const parsed = Number(rawBal);
        balanceNum = Number.isFinite(parsed) ? parsed : 0;
      }
      // Currency resolution priority:
      // 1. preferredCurrencyCode (explicit user preference)
      // 2. linked currency relation code (if any)
      // 3. fallback default (system-wide) -> 'USD'
      const currencyCode = u.preferredCurrencyCode || (u.currency && u.currency.code) || 'USD';
  const resp = {
        username: u.username || null,
        email: u.email || null,
        balance: balanceNum,
        currency: currencyCode,
      };
  if (debugEnabled('clientApiProfile')) debugLog('clientApiProfile', 'end', { reqId, status: 200 });
  return resp;
    } catch (e: any) {
      // Surface root cause in logs so we stop getting generic {code:500,"Unknown error"}
      // This will still be mapped by the global filter but with stack trace available in container logs.
      // Remove after diagnosing production issue.
      // eslint-disable-next-line no-console
  console.error('[CLIENT_API][PROFILE][ERROR]', {
        reqId: req.reqId || null,
        host: (req.headers && (req.headers['host'] as string)) || null,
        tenantId: req.tenant?.id || null,
        tokenHash8: req.clientApiTokenHash8 || null,
        tokenLen: req.clientApiTokenLen || null,
        userId: req.clientApiUser?.id || null,
        msg: e?.message,
        stack: e?.stack?.split('\n').slice(0,5).join(' | '),
      });
      throw e; // rethrow so filter handles mapping
    }
  }

  @Get('products')
  async products(@Req() req: any, @Query('product_id') productId?: string, @Query('products_id') products_id?: string, @Query('base') base?: string) {
    let ids: string[] | undefined;
    if (products_id) ids = products_id.split(',').map(s => s.trim()).filter(Boolean).slice(0, 200);
    else if (productId) ids = [productId];
    const list = await this.service.listProducts(req.tenant.id, req.clientApiUser.id, { filterIds: ids, baseOnly: base === '1' });
    return list;
  }

  @Get('content/:categoryId')
  content(@Req() req: any, @Param('categoryId') categoryId: string) {
    return this.service.listContent(req.tenant.id, req.clientApiUser.id, categoryId);
  }

  @Post('newOrder/:packageId/params')
  async newOrder(
    @Req() req: any,
    @Param('packageId') packageId: string,
    @Query('qty') qty?: string,
    @Query('order_uuid') orderUuid?: string,
    @Query() allQuery?: any,
  ) {
    const quantity = Number(qty || '1');
    const user_identifier = allQuery?.user_identifier as string | undefined;
    const extra_field = allQuery?.extra_field as string | undefined;
    const result = await this.service.createUnifiedClientOrder({
      tenantId: req.tenant.id,
      userId: req.clientApiUser.id,
      packageId,
      orderUuid: orderUuid || null,
      quantity,
      userIdentifier: user_identifier || null,
      extraField: extra_field || null,
      rawQuery: allQuery,
    });
    return result;
  }

  @Get('check')
  async check(@Req() req: any, @Query('orders') orders?: string, @Query('uuid') uuidFlag?: string) {
    const list = (orders||'').split(',').map(s=>s.trim()).filter(Boolean).slice(0,50);
    const byUuid = uuidFlag === '1';
    const results = [] as any[];
    for (const id of list) {
      const orderObj = byUuid
        ? await this.service.checkOrderByUuid(req.tenant.id, req.clientApiUser.id, id)
        : await this.service.checkOrder(req.tenant.id, req.clientApiUser.id, id);
      if (orderObj) results.push(this.service.toPublic(orderObj));
    }
    return results;
  }
}
