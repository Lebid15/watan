// src/products/product-orders.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  Patch,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CreateOrderDto } from './dto/create-order.dto';
import type { Request } from 'express';
import { ProductsService } from './products.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { ListOrdersDto } from './dto/list-orders.dto';

export type OrderStatus = 'pending' | 'approved' | 'rejected';

@UseGuards(JwtAuthGuard)
@ApiTags('orders')
@Controller('orders')
export class ProductOrdersController {
  constructor(private readonly productsService: ProductsService) {}

  /** طلبات المستخدم الحالي — الآن مع pagination (items + pageInfo) */
  @Get('me')
  async getMyOrders(@Req() req: Request, @Query() query: ListOrdersDto) {
    const user = req.user as any;
    // ملاحظة: دالة السيرفس تستقبل (dto, tenantId?) لذلك نمرّر tenantId كوسيط ثاني
    // ونكتفي بتمرير userId داخل الـ dto. كان سابقاً يُمرَّر tenantId داخل dto فقط (يُتجاهَل).
    return this.productsService.listOrdersWithPagination(
      {
        ...query,
        // خصائص مؤقتة يقرأها السيرفس للتصفية
        // @ts-ignore
        userId: user.id,
      } as any,
      // @ts-ignore
      user.tenantId,
    );
  }

  /** (اختياري) طلبات مستخدم محدد — للأدمن فقط — مع pagination */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('user/:userId')
  async getUserOrdersAdmin(
    @Param('userId') userId: string,
    @Query() query: ListOrdersDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.productsService.listOrdersWithPagination({
      ...query,
      // @ts-ignore
      userId,
      // @ts-ignore
      tenantId: user.tenantId, // ⬅︎ تقييد ضمن تينانت الأدمن
    } as any);
  }

  /** كل الطلبات — للأدمن فقط — مع pagination */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get()
  async getAllOrders(@Query() query: ListOrdersDto, @Req() req: Request) {
    const user = req.user as any;
    // ترجع { items, pageInfo: { nextCursor, hasMore }, meta }
    return this.productsService.listOrdersForAdmin({
      ...query,
      // @ts-ignore
      tenantId: user.tenantId, // ⬅︎ تمرير التينانت للتصفية على مستوى السيرفس
    } as any);
  }

  /** ✅ تفاصيل طلب للمستخدم الحالي (تشمل الملاحظات والرسائل) */
  @Get(':id')
  async getOrderDetails(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    // هنا نستخدم دالة السيرفس القائمة التي تتحقق من أن الطلب يعود لنفس المستخدم
    return this.productsService.getOrderDetailsForUser(id, user.id);
  }

  /** إنشاء طلب جديد (المستخدم الحالي فقط) */
  @Post()
  @ApiOkResponse({
    description: 'Order created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        order_uuid: { type: 'string', nullable: true },
        origin: { type: 'string', example: 'panel' },
        status: { type: 'string', example: 'pending' },
        quantity: { type: 'string', example: '2.5' },
        price_usd: { type: 'number', example: 3.125 },
        unit_price_usd: { type: 'number', example: 1.25 },
        unitPriceApplied: { type: 'string', example: '1.2500' },
        sellPrice: { type: 'string', example: '3.1250' },
        cost: { type: 'string', nullable: true, example: '0.0000' },
        profit: { type: 'string', nullable: true, example: '3.1250' },
        created_at: { type: 'string', format: 'date-time' },
        product: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string', nullable: true } } },
        package: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string', nullable: true } } },
        userIdentifier: { type: 'string', nullable: true },
        extraField: { type: 'string', nullable: true },
        reused: { type: 'boolean', example: false },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'ERR_UNIT_NOT_SUPPORTED | ERR_QUANTITY_REQUIRED | ERR_QTY_BELOW_MIN | ERR_QTY_ABOVE_MAX | ERR_QTY_STEP_MISMATCH | ERR_UNIT_PRICE_MISSING' })
  async createOrder(
    @Body() body: CreateOrderDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;

    const unified = await this.productsService.createOrder({
      productId: body.productId,
      packageId: body.packageId,
      quantity: body.quantity ? Number(body.quantity) : (body as any).quantity,
      userId: user.id,
      userIdentifier: body.userIdentifier,
      extraField: body.extraField,
      orderUuid: body.orderUuid || null,
      origin: 'panel',
    }, user.tenantId);

    return {
      id: unified.id,
      order_uuid: unified.order_uuid || null,
      origin: unified.origin,
      status: unified.status,
      quantity: unified.quantity != null ? String(unified.quantity) : null,
      price_usd: unified.priceUSD,
      unit_price_usd: unified.unitPriceUSD,
      created_at: unified.createdAt,
      product: unified.product,
      package: unified.package,
      userIdentifier: unified.userIdentifier ?? null,
      extraField: unified.extraField ?? null,
      reused: unified.reused || false,
      unitPriceApplied: (unified as any).unitPriceApplied || null,
      sellPrice: (unified as any).sellPrice || null,
      cost: (unified as any).cost || null,
      profit: (unified as any).profit || null,
    };
  }

  /** تعديل حالة الطلب — للأدمن */
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  async setStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body('status') status: 'approved' | 'rejected',
    @Req() req: Request,
  ) {
    // مبدئيًا لا نتحقق من tenant هنا، سنعتمد على تصفية السيرفس لاحقًا عندما نضيف شرط tenant
    const updated = await this.productsService.updateOrderStatus(id, status);
    return { ok: true, id, status: updated?.status ?? status };
  }
}
