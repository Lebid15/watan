import { Body, Controller, Get, Param, Post, Req, UseGuards, UseInterceptors, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { ExternalAuthGuard } from './external-auth.guard';
import { Scopes } from './scopes.decorator';
import { ProductsService } from '../products/products.service';
import { ExternalRateLimitInterceptor } from './external-rate-limit.interceptor';
import { ExternalIdempotencyInterceptor } from './external-idempotency.interceptor';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductPackage } from '../products/product-package.entity';
import { Product } from '../products/product.entity';
import { ProductOrder } from '../products/product-order.entity';

@Controller('/api/tenant/external/v1')
@UseGuards(ExternalAuthGuard)
@UseInterceptors(ExternalRateLimitInterceptor, ExternalIdempotencyInterceptor)
export class ExternalOrdersController {
  constructor(
    private products: ProductsService,
    @InjectRepository(ProductPackage) private packagesRepo: Repository<ProductPackage>,
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(ProductOrder) private ordersRepo: Repository<ProductOrder>,
  ) {}

  @Post('orders')
  @Scopes('orders.create')
  async createOrder(
    @Req() req: any,
    @Body() body: { publicCode: number; quantity: number; userIdentifier?: string; note?: string },
  ) {
    const token = req.externalToken;
    const tenantId = token.tenantId;
    const userId = token.userId;
    const code = Number(body.publicCode);
    if (!Number.isInteger(code))
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'INVALID_CODE',
      });
    const pkg = await this.packagesRepo.findOne({
      where: { tenantId, publicCode: code } as any,
      relations: ['product'],
    });
    if (!pkg)
      throw new UnprocessableEntityException({
        code: 'VALIDATION_ERROR',
        message: 'NOT_FOUND',
      });
    const view = await this.products.createOrder({ productId: (pkg as any).product.id, packageId: pkg.id, quantity: body.quantity, userId, userIdentifier: body.userIdentifier }, tenantId);
    return { orderId: view.id, status: view.status, createdAt: view.createdAt };
  }

  @Get('orders/:id')
  @Scopes('orders.read')
  async getOrder(@Req() req: any, @Param('id') id: string) {
    const token = req.externalToken;
    const order = await this.ordersRepo.findOne({ where: { id } as any, relations: ['user','product','package'] });
    if (!order) return { notFound: true };
  if (order.user.id !== token.userId) throw new ForbiddenException('FORBIDDEN');
    return { orderId: order.id, status: order.status, quantity: order.quantity, createdAt: order.createdAt };
  }
}
