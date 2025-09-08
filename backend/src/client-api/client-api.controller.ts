import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UseFilters } from '@nestjs/common';
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
  profile(@Req() req: any) {
    try {
      const u = req.clientApiUser;
      if (!u) throw new Error('profile_missing_user_ctx');
      // Normalize balance (TypeORM decimal => string sometimes)
      const rawBal: any = u.balance;
      const balanceNum = typeof rawBal === 'number' ? rawBal : Number(rawBal);
      if (Number.isNaN(balanceNum)) throw new Error('profile_balance_nan');
      // Currency resolution priority:
      // 1. preferredCurrencyCode (explicit user preference)
      // 2. linked currency relation code (if any)
      // 3. fallback default (system-wide) -> 'USD'
      const currencyCode = u.preferredCurrencyCode || (u.currency && u.currency.code) || 'USD';
      return {
        username: u.username || null,
        email: u.email || null,
        balance: balanceNum,
        currency: currencyCode,
      };
    } catch (e: any) {
      // Surface root cause in logs so we stop getting generic {code:500,"Unknown error"}
      // This will still be mapped by the global filter but with stack trace available in container logs.
      // Remove after diagnosing production issue.
      // eslint-disable-next-line no-console
      console.error('[CLIENT_API][PROFILE][ERROR]', { msg: e?.message, stack: e?.stack?.split('\n').slice(0,4).join(' | ') });
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
