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
    const u = req.clientApiUser;
    return {
      username: u.username,
      email: u.email,
      balance: Number(u.balance),
      currency: u.preferredCurrencyCode || null,
    };
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

  @Post('newOrder/:productId/params')
  async newOrder(
    @Req() req: any,
    @Param('productId') productId: string,
    @Query('qty') qty?: string,
    @Query('order_uuid') orderUuid?: string,
    @Query() allQuery?: any,
  ) {
    const quantity = Number(qty || '1');
    const user_identifier = allQuery?.user_identifier as string | undefined;
    const extra_field = allQuery?.extra_field as string | undefined;
    const { order, reused } = await this.service.createOrder({
      tenantId: req.tenant.id,
      userId: req.clientApiUser.id,
      productId,
      orderUuid: orderUuid,
      quantity,
      userIdentifier: user_identifier,
      extraField: extra_field,
      rawQuery: allQuery,
    });
    return { reused: !!reused, ...this.service.toPublic(order) };
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
