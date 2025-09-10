// src/products/product-orders.admin.controller.ts
import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  NotFoundException,
  UseGuards,
  Post,
  BadRequestException,
  ParseUUIDPipe,
  Logger,
  Query,
  Header,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserRole } from '../auth/user-role.enum';

import { ProductsService, OrderStatus } from './products.service';
import { ProductOrder } from './product-order.entity';
import { OrderDispatchLog } from './order-dispatch-log.entity';
import { PackageRouting } from '../integrations/package-routing.entity';
import { PackageCost } from '../integrations/package-cost.entity';
import { PackageMapping } from '../integrations/package-mapping.entity';
import { IntegrationsService } from '../integrations/integrations.service';
import { ListOrdersDto } from './dto/list-orders.dto';

type ExternalStatus =
  | 'not_sent'
  | 'queued'
  | 'sent'
  | 'processing'
  | 'done'
  | 'failed';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.INSTANCE_OWNER)
@Controller('admin/orders')
export class ProductOrdersAdminController {
  private readonly logger = new Logger(ProductOrdersAdminController.name);

  constructor(
    private readonly productsService: ProductsService,
    private readonly integrations: IntegrationsService,

    @InjectRepository(ProductOrder)
    private readonly orderRepo: Repository<ProductOrder>,

    @InjectRepository(OrderDispatchLog)
    private readonly logRepo: Repository<OrderDispatchLog>,

    @InjectRepository(PackageRouting)
    private readonly routingRepo: Repository<PackageRouting>,

    @InjectRepository(PackageCost)
    private readonly costRepo: Repository<PackageCost>,

    @InjectRepository(PackageMapping)
    private readonly mappingRepo: Repository<PackageMapping>,
  ) {}

  /** تحويل Decimals/strings إلى number */
  private num(v: any): number | undefined {
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }

  /** تفطيح كائن الطلب لشكل يناسب الواجهة (يحترم الحقول الجاهزة من السيرفس) */
  private toClient(o: any) {
    const preSellTRY = (o as any).sellTRY;
    const preCostTRY = (o as any).costTRY;
    const preProfitTRY = (o as any).profitTRY;
    const preCurrencyTRY = (o as any).currencyTRY;

    const num = (v: any): number | undefined => {
      if (v == null) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const calcSellTRY =
      num((o as any).sellTryAtApproval) ??
      ((o as any).sellPriceCurrency === 'TRY'
        ? num((o as any).sellPriceAmount ?? (o as any).price)
        : undefined);

    const calcCostTRY =
      num((o as any).costTryAtApproval) ??
      ((o as any).costCurrency === 'TRY' ? num((o as any).costAmount) : undefined);

    const calcProfitTRY =
      num((o as any).profitTryAtApproval) ??
      (calcSellTRY != null && calcCostTRY != null
        ? Number((calcSellTRY - calcCostTRY).toFixed(2))
        : undefined);

    const sellTRY = preSellTRY != null ? preSellTRY : calcSellTRY;
    const costTRY = preCostTRY != null ? preCostTRY : calcCostTRY;
    const profitTRY = preProfitTRY != null ? preProfitTRY : calcProfitTRY;

    const currencyTRY =
      preCurrencyTRY ??
      (sellTRY != null || costTRY != null || profitTRY != null ? 'TRY' : undefined);

    const notesCountReady =
      (o as any).notesCount != null
        ? Number((o as any).notesCount)
        : Array.isArray((o as any).notes)
        ? (o as any).notes.length
        : 0;

    return {
      id: o.id,
      orderNo: (o as any).orderNo ?? null,
      status: o.status,
      userIdentifier: (o as any).userIdentifier ?? null,

      username:
        ((o as any).user && ((o as any).user.username || (o as any).user.fullName)) ||
        (o as any).username || undefined,
      userEmail:
        ((o as any).user && (o as any).user.email) ||
        (o as any).userEmail || undefined,

      product: (o as any).product
        ? {
            id: (o as any).product.id,
            name: (o as any).product.name,
            imageUrl: (o as any).product.imageUrl || null, // imageUrl now computed in service layer
            imageSource: (o as any).product.imageSource || undefined,
            hasCustomImage: (o as any).product.hasCustomImage ?? undefined,
            customImageUrl: (o as any).product.customImageUrl ?? undefined,
          }
        : undefined,
      package: (o as any).package
        ? {
            id: (o as any).package.id,
            name: (o as any).package.name,
            imageUrl:
              (o as any).package.imageUrl ||
              (o as any).package.image ||
              (o as any).package.logoUrl ||
              (o as any).package.iconUrl ||
              null,
            productId:
              ((o as any).product && (o as any).product.id) ??
              (o as any).package?.productId ??
              null,
          }
        : undefined,

      providerId: (o as any).providerId ?? null,
      providerName: (o as any).providerName ?? null,
      externalOrderId: (o as any).externalOrderId ?? null,

      createdAt: (o as any).createdAt,
      sentAt: (o as any).sentAt ?? null,
      completedAt: (o as any).completedAt ?? null,
      durationMs: (o as any).durationMs ?? null,

      fxLocked: (o as any).fxLocked ?? false,
      approvedLocalDate: (o as any).approvedLocalDate ?? undefined,

      sellPriceAmount: this.num((o as any).sellPriceAmount ?? (o as any).price),
      sellPriceCurrency: (o as any).sellPriceCurrency ?? (o as any).currencyCode ?? 'USD',
      costAmount: this.num((o as any).costAmount),
      costCurrency: (o as any).costCurrency ?? 'USD',
      price: this.num((o as any).price),

      sellTRY,
      costTRY,
      profitTRY,
      currencyTRY,

      providerMessage:
        (o as any).providerMessage ??
        (o as any).lastMessage ??
        null,
      pinCode: (o as any).pinCode ?? null,
      notesCount: notesCountReady,
      manualNote: (o as any).manualNote ?? null,
    };
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async list(@Query() query: ListOrdersDto, @Req() req: Request) {
    const user = req.user as any;
    // استرجاع tenantId من المستخدم أو من الـ middleware (req.tenant)
    let tenantId: string | undefined = user?.tenantId || (req as any)?.tenant?.id;
    if (!tenantId) {
      // منع تمرير قيمة فارغة تؤدي لخطأ invalid UUID في الاستعلام
      throw new BadRequestException('TENANT_ID_REQUIRED');
    }
    if (typeof tenantId !== 'string' || tenantId.trim() === '' || !/^[0-9a-fA-F-]{36}$/.test(tenantId)) {
      throw new BadRequestException('INVALID_TENANT_ID');
    }
    // تمرير tenantId كوسيط ثانٍ صريح (الخدمة تتوقعه خارج الـ dto)
    const res = await this.productsService.listOrdersForAdmin(query, tenantId);

    if (res && Array.isArray((res as any).items)) {
      return res;
    }
    if (Array.isArray(res)) {
      return (res as any).map((o: ProductOrder) => this.toClient(o));
    }
    return res;
  }

  @Get('all')
  async getAllOrders(@Req() req: Request) {
  const user = req.user as any;
    let tenantId: string | undefined = user?.tenantId || (req as any)?.tenant?.id;
    if (!tenantId) {
      throw new BadRequestException('TENANT_ID_REQUIRED');
    }
    if (typeof tenantId !== 'string' || tenantId.trim() === '' || !/^[0-9a-fA-F-]{36}$/.test(tenantId)) {
      throw new BadRequestException('INVALID_TENANT_ID');
    }
    // تمرير tenantId لتقييد النتائج
    const items = await this.productsService.getAllOrders(undefined, tenantId);
    return Array.isArray(items) ? items.map((o) => this.toClient(o)) : items;
  }

  /** ✅ إنشاء ملاحظة على طلب */
  @Post(':id/notes')
  async addNote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { text: string; by?: 'admin' | 'system' | 'user' },
  ) {
    const text = (body?.text || '').trim();
    if (!text) throw new BadRequestException('النص مطلوب');
    const by = (body?.by as any) || 'admin';

    const notes = await this.productsService.addOrderNote(id, by, text);
    return { orderId: id, notes };
  }

  /** ✅ جلب ملاحظات طلب */
  @Get(':id/notes')
  async getNotes(@Param('id', new ParseUUIDPipe()) id: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    return { orderId: id, notes: (order as any).notes ?? [] };
  }

  /** 🔹 تحويل الطلبات المحددة إلى Manual */
  @Post('bulk/manual')
  async setManual(@Body() body: { ids: string[]; note?: string }, @Req() req: Request) {
    const { ids, note } = body || {};
    if (!ids?.length) throw new BadRequestException('ids is required');

    const tenantId = (req as any).user?.tenantId;
    const orders = await this.orderRepo.createQueryBuilder('o')
      .innerJoinAndSelect('o.user', 'u')
      .where('o.id IN (:...ids)', { ids })
      .andWhere('u.tenantId = :tid', { tid: tenantId })
      .getMany();

    for (const order of orders) {
      (order as any).providerId = null;
      (order as any).externalOrderId = null;
      (order as any).externalStatus = 'not_sent';
      (order as any).sentAt = null;
      (order as any).lastSyncAt = null;
      (order as any).completedAt = null;
      (order as any).durationMs = null;

      if (note) (order as any).manualNote = note.slice(0, 500);
      await this.orderRepo.save(order);

      await this.productsService.addOrderNote(order.id, 'admin', note ? `Manualize: ${note}` : 'Manualize');

      await this.logRepo.save(
        this.logRepo.create({
          order,
          action: 'dispatch',
          result: 'success',
          message: 'Set to Manual',
          payloadSnapshot: { manualize: true, note },
        }),
      );
    }
    return { updated: orders.length };
  }

  /** 🔹 إرسال جماعي */
  @Post('bulk/dispatch')
  async bulkDispatch(
    @Body() body: { ids: string[]; providerId?: string; note?: string },
    @Req() req: Request
  ){
    const { ids, providerId, note } = body || {};
    if (!ids?.length) throw new BadRequestException('ids is required');

    const tenantId = (req as any).user?.tenantId;
    const orders = await this.orderRepo.createQueryBuilder('o')
      .innerJoinAndSelect('o.user', 'u')
      .where('o.id IN (:...ids)', { ids })
      .andWhere('u.tenantId = :tid', { tid: tenantId })
      .getMany();

    this.logger.debug(`bulk/dispatch: got ${orders.length} orders`);

    const results: Array<{ id: string; ok: boolean; message?: string }> = [];

    for (const order of orders) {
      try {
        if ((order as any).externalOrderId) {
          results.push({ id: order.id, ok: false, message: 'already sent' });
          continue;
        }
        await this.performDispatch(order, providerId, note, tenantId); // ← تمرير tenantId
        if (note) await this.productsService.addOrderNote(order.id, 'admin', `Dispatch: ${note}`);
        results.push({ id: order.id, ok: true });
      } catch (e: any) {
        const msg = String(e?.message ?? 'fail');
        this.logger.warn(`bulk/dispatch fail for ${order.id}: ${msg}`);
        await this.productsService.addOrderNote(order.id, 'system', `Dispatch failed: ${msg}`);
        results.push({ id: order.id, ok: false, message: msg });
      }
    }

    return {
      message: 'bulk dispatch finished',
      total: ids.length,
      success: results.filter((r) => r.ok).length,
      fail: results.filter((r) => !r.ok).length,
      results,
    };
  }

  /** 🔹 موافقة جماعية */
  @Post('bulk/approve')
  async bulkApprove(@Body() body: { ids: string[]; note?: string }, @Req() req: Request){
    const { ids, note } = body || {};
    if (!ids?.length) throw new BadRequestException('ids is required');

    const tenantId = (req as any).user?.tenantId;
    const orders = await this.orderRepo.createQueryBuilder('o')
      .innerJoinAndSelect('o.user', 'u')
      .where('o.id IN (:...ids)', { ids })
      .andWhere('u.tenantId = :tid', { tid: tenantId })
      .getMany();

    let ok = 0, fail = 0;

    for (const order of orders) {
      try {
        if (note) {
          (order as any).manualNote = note.slice(0, 500);
          await this.orderRepo.save(order);
          await this.productsService.addOrderNote(order.id, 'admin', `Approve: ${note}`);
        }
        await this.productsService.updateOrderStatus(order.id, 'approved');
        await this.logRepo.save(
          this.logRepo.create({
            order,
            action: 'dispatch',
            result: 'success',
            message: 'Manual approved (bulk)',
            payloadSnapshot: { manual: true, bulk: true },
          }),
        );
        ok++;
      } catch (e: any) {
        await this.productsService.addOrderNote(
          order.id,
          'system',
          `Approve failed: ${String(e?.message || 'fail')}`,
        );
        fail++;
      }
    }
    return { message: 'bulk approve finished', total: ids.length, success: ok, fail };
  }

  /** 🔹 رفض جماعي */
  @Post('bulk/reject')
  async bulkReject(@Body() body: { ids: string[]; note?: string }, @Req() req: Request){
    const { ids, note } = body || {};
    if (!ids?.length) throw new BadRequestException('ids is required');

    const tenantId = (req as any).user?.tenantId;
    const orders = await this.orderRepo.createQueryBuilder('o')
      .innerJoinAndSelect('o.user', 'u')
      .where('o.id IN (:...ids)', { ids })
      .andWhere('u.tenantId = :tid', { tid: tenantId })
      .getMany();

    let ok = 0, fail = 0;

    for (const order of orders) {
      try {
        if (note) {
          (order as any).manualNote = note.slice(0, 500);
          await this.orderRepo.save(order);
          await this.productsService.addOrderNote(order.id, 'admin', `Reject: ${note}`);
        }
        await this.productsService.updateOrderStatus(order.id, 'rejected');
        await this.logRepo.save(
          this.logRepo.create({
            order,
            action: 'dispatch',
            result: 'fail',
            message: 'Manual rejected (bulk)',
            payloadSnapshot: { manual: true, bulk: true },
          }),
        );
        ok++;
      } catch (e: any) {
        await this.productsService.addOrderNote(
          order.id,
          'system',
          `Reject failed: ${String(e?.message || 'fail')}`,
        );
        fail++;
      }
    }
    return { message: 'bulk reject finished', total: ids.length, success: ok, fail };
  }

  /** 🔹 إرسال فردي */
  @Post(':id/dispatch')
  async dispatchOrder(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { providerId?: string; note?: string },
    @Req() req: Request
  ) {
    const tenantId = (req as any).user?.tenantId;
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['user'] });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if ((order as any).user?.tenantId !== tenantId) {
      throw new ForbiddenException('لا تملك صلاحية على هذا الطلب');
    }

    if ((order as any).externalOrderId) {
      throw new BadRequestException('الطلب تم إرساله مسبقًا');
    }

    const result = await this.performDispatch(order, body.providerId, body.note, tenantId); // ← تمرير tenantId
    if (body?.note) await this.productsService.addOrderNote(order.id, 'admin', `Dispatch: ${body.note}`);
    return { message: 'تم إرسال الطلب للموفّر', order: result };
  }

  /** 🔹 تحديث حالة الطلب من المزوّد (قديم) */
  @Post(':id/refresh')
  async refreshOrder(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.syncExternal(id);
  }

  /** ✅ مسار يدوي: سحب الحالة والملاحظة فورًا من المزوّد */
  @Patch(':id/sync-external')
  async syncExternal(@Param('id', new ParseUUIDPipe()) id: string) {
    const result = await this.productsService.syncExternal(id);
    return { message: 'تمت المزامنة مع المزوّد', order: result.order };
  }

  /** 🔹 تعديل حالة الطلب يدويًا */
  @Patch(':id/status')
  async updateOrderStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { status: OrderStatus; note?: string },
    @Req() req: Request
  ) {
    const { status, note } = body;
    if (!['approved', 'rejected'].includes(status)) {
      throw new NotFoundException('الحالة غير صحيحة');
    }

    const tenantId = (req as any).user?.tenantId;
    const order = await this.orderRepo.findOne({ where: { id }, relations: ['user'] });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if ((order as any).user?.tenantId !== tenantId) {
      throw new ForbiddenException('لا تملك صلاحية على هذا الطلب');
    }

    if (note) {
      (order as any).manualNote = note.slice(0, 500);
      await this.orderRepo.save(order);
      await this.productsService.addOrderNote(order.id, 'admin', `Manual ${status}: ${note}`);
      // Surface admin note to requester via providerMessage/lastMessage
      await this.orderRepo.update({ id: order.id } as any, {
        providerMessage: note.slice(0, 250),
        lastMessage: `Manual ${status}: ${note.slice(0, 200)}`,
      } as any);
    } else {
      await this.productsService.addOrderNote(order.id, 'admin', `Manual ${status}`);
      await this.orderRepo.update({ id: order.id } as any, {
        lastMessage: `Manual ${status}`,
      } as any);
    }

    const updated = await this.productsService.updateOrderStatus(id, status);
    if (!updated) throw new NotFoundException('تعذّر تحديث حالة الطلب');

    const terminalExternal = status === 'approved' ? 'done' : ('failed' as const);

    const completedAt = new Date();
    const durationMs = (updated as any).sentAt
      ? completedAt.getTime() - new Date((updated as any).sentAt).getTime()
      : (updated as any).durationMs ?? 0;

    await this.orderRepo.update(
      { id: (updated as any).id },
      {
        externalStatus: terminalExternal,
        completedAt,
        durationMs,
        lastSyncAt: new Date(),
        lastMessage: status === 'approved' ? 'Manual approval' : 'Manual rejection',
      } as any,
    );

    await this.logRepo.save(
      this.logRepo.create({
        order: { id: (updated as any).id } as any,
        action: 'dispatch',
        result: status === 'approved' ? 'success' : 'fail',
        message: `Manual ${status}`,
        payloadSnapshot: { manual: true },
      }),
    );

    const finalOrder = await this.orderRepo.findOne({ where: { id: (updated as any).id } });
    return { message: 'تم تحديث حالة الطلب بنجاح', order: finalOrder };
  }

  /** 🔹 جلب السجلات */
  @Get(':id/logs')
  async getLogs(@Param('id', new ParseUUIDPipe()) id: string) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('الطلب غير موجود');

    const logs = await this.logRepo.find({
      where: { order: { id } as any },
      order: { createdAt: 'DESC' as any },
      take: 50,
    });

    return { orderId: id, logs };
  }

  /** 🔸 توحيد حالات المزوّد */
  private normalizeExternalStatus(raw?: string): ExternalStatus {
    const s = (raw || '').toString().toLowerCase();
    if (['success', 'completed', 'complete', 'ok', 'done'].includes(s)) return 'done';
    if (['fail', 'failed', 'error', 'rejected', 'cancelled', 'canceled'].includes(s)) return 'failed';
    if (['accepted'].includes(s)) return 'sent';
    if (['sent', 'queued', 'queue'].includes(s)) return 'sent';
    if (['processing', 'inprogress', 'running', 'pending'].includes(s)) return 'processing';
    return 'processing';
  }

  /** ♻️ تنفيذ الإرسال */
  private async performDispatch(
    orderInput: ProductOrder,
    providerId?: string | null,
    note?: string,
    tenantId?: string, // ← أضفنا tenantId هنا
  ) {
    const order =
      (orderInput as any)?.package && (orderInput as any)?.user
        ? orderInput
        : await this.orderRepo.findOne({
            where: { id: orderInput.id },
            relations: ['package', 'user'],
          });

    if (!order) throw new NotFoundException('الطلب غير موجود (relations)');
    if (!(order as any).package) throw new BadRequestException('لا توجد باقة مرتبطة بالطلب');
    if (!(order as any).user) throw new BadRequestException('لا يوجد مستخدم مرتبط بالطلب');

    // ✅ نحسب effectiveTenantId لاستدعاءات integrations
    const effectiveTenantId = String(tenantId ?? (order as any)?.user?.tenantId ?? '');

    let chosenProviderId = providerId ?? null;
    if (!chosenProviderId) {
      const routing = await this.routingRepo.findOne({
        where: { package: { id: (order as any).package.id } as any },
        relations: ['package'],
      });
      if (!routing || routing.mode === 'manual' || !routing.primaryProviderId) {
        throw new BadRequestException('هذه الباقة مُعينة على Manual أو لا يوجد مزوّد أساسي');
      }
      chosenProviderId = routing.primaryProviderId;
    }

    const mapping = await this.mappingRepo.findOne({
      where: {
        our_package_id: (order as any).package.id as any,
        provider_api_id: chosenProviderId as any,
      },
    });
    if (!mapping) {
      throw new BadRequestException('لا يوجد ربط لهذه الباقة عند هذا المزوّد');
    }

    const costRow = await this.costRepo.findOne({
      where: { package: { id: (order as any).package.id } as any, providerId: chosenProviderId as any },
      relations: ['package'],
    });

    const costCurrency = (costRow as any)?.costCurrency ?? 'USD';
    const basePrice = Number(((order as any).package as any)?.basePrice ?? 0);
    const costAmount =
      Number((costRow as any)?.costAmount ?? 0) > 0 ? Number((costRow as any).costAmount) : basePrice;

    const musteriTel =
      ((order as any).user as any)?.phoneNumber &&
      String(((order as any).user as any).phoneNumber).trim().length > 0
        ? String(((order as any).user as any).phoneNumber).trim()
        : '111111111';

    let oyun: string | undefined;
    let kupur: string | undefined;

    // ↙️ تمرير tenantId الإلزامي الآن
    const providerProducts = await this.integrations.syncProducts(chosenProviderId!, effectiveTenantId);
    const matched = providerProducts.find(
      (p: any) => String(p.externalId) === String((mapping as any).provider_package_id),
    );
    if (matched?.meta) {
      oyun = matched.meta.oyun ?? matched.meta.oyun_bilgi_id ?? undefined;
      kupur = matched.meta.kupur ?? undefined;
    }

    const payload = {
      productId: String((mapping as any).provider_package_id),
      qty: Number((order as any).quantity ?? 1),
      params: {
        oyuncu_bilgi: (order as any).userIdentifier ?? undefined,
        musteri_tel: musteriTel,
        oyun,
        kupur,
        extra: (order as any).extraField ?? undefined,
      },
      clientOrderUuid: order.id,
    };

    this.logger.debug(
      `dispatch -> provider=${chosenProviderId} pkgMap=${(mapping as any).provider_package_id} oyun=${oyun} kupur=${kupur} user=${(order as any).userIdentifier}`,
    );

    // ↙️ placeOrder الآن يتطلب tenantId أيضًا
    const res = await this.integrations.placeOrder(
      chosenProviderId!,
      effectiveTenantId,
      payload,
    );

    const externalOrderId = (res as any)?.externalOrderId ?? null;
    const statusRaw: string =
      (res as any)?.providerStatus ?? ((res as any)?.mappedStatus as any) ?? 'sent';

    const messageRaw: string =
      ((res as any)?.raw &&
        ((((res as any).raw.message as any) || (res as any).raw.desc || (res as any).raw.note || (res as any).raw.raw))) ||
      'sent';
    const noteFromRes: string | undefined = (res as any)?.note?.toString?.().trim?.() || undefined;
    const message: string = String((noteFromRes && noteFromRes !== 'sync' ? noteFromRes : messageRaw) || '').slice(0, 250) || 'sent';
    const extStatus = this.normalizeExternalStatus(statusRaw || 'processing');

    let finalCostAmount = costAmount;
    let finalCostCurrency = costCurrency;

    if (res) {
      const priceVal: any = (res as any).price;
      const num = typeof priceVal === 'string' ? Number(priceVal) : priceVal;
      if (typeof num === 'number' && Number.isFinite(num) && num > 0) {
        finalCostAmount = num;
        finalCostCurrency = ((res as any).costCurrency as string) || finalCostCurrency;
      }
    }

    (order as any).providerId = chosenProviderId!;
    (order as any).externalOrderId = externalOrderId;
    (order as any).externalStatus = extStatus;
    (order as any).sentAt = new Date();
    (order as any).lastSyncAt = new Date();
    (order as any).lastMessage = String(message ?? '').slice(0, 250);
    if (noteFromRes && noteFromRes !== 'sync' && noteFromRes !== 'sent') {
      (order as any).providerMessage = noteFromRes;
    } else if (message && message !== 'sync' && message !== 'sent') {
      (order as any).providerMessage = message;
    }
    (order as any).attempts = ((order as any).attempts ?? 0) + 1;

    (order as any).costCurrency = finalCostCurrency;
    (order as any).costAmount = Number(finalCostAmount.toFixed(2));

    const sell = Number((order as any).sellPriceAmount ?? (order as any).price ?? 0);
    (order as any).profitAmount = Number((sell - (order as any).costAmount).toFixed(2));

    // 🔒 Maintain USD snapshots for correct USD profit in UI
    try {
      const sellUsdSnap = (order as any).sellUsdAtOrder != null
        ? Number((order as any).sellUsdAtOrder)
        : Number((order as any).price ?? 0);
      if (String(finalCostCurrency || '').toUpperCase() === 'USD') {
        (order as any).costUsdAtOrder = Number(finalCostAmount.toFixed(4));
        (order as any).profitUsdAtOrder = Number((sellUsdSnap - Number((order as any).costUsdAtOrder)).toFixed(4));
      }
    } catch {}

    if (note) (order as any).manualNote = note.slice(0, 500);

    await this.orderRepo.save(order);

    await this.logRepo.save(
      this.logRepo.create({
        order,
        action: 'dispatch',
        result: 'success',
        message,
        payloadSnapshot: { providerId: chosenProviderId, payload, response: res },
      }),
    );

    await this.productsService.addOrderNote(order.id, 'system', `Dispatched → ext=${extStatus}, msg=${message}`);

    return order;
  }
}
