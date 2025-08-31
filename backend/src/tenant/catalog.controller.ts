import { Controller, Post, Body, UseGuards, Req, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FinalRoles, FinalRolesGuard } from '../common/authz/roles';
import { ProductsService } from '../products/products.service';
import { isFeatureEnabled } from '../common/feature-flags';

// Phase2: تفعيل منتج كتالوج للمتجر (tenant_owner فقط)
@Controller('tenant/catalog')
@UseGuards(JwtAuthGuard, FinalRolesGuard)
export class TenantCatalogController {
  constructor(private readonly products: ProductsService) {}

  @Post('activate-product')
  @FinalRoles('tenant_owner')
  async activate(@Body('catalogProductId') catalogProductId: string, @Req() req: any) {
    if (!isFeatureEnabled('catalogLinking')) throw new ForbiddenException('Feature disabled');
    const tenantId = req?.tenant?.id || req?.user?.tenantId;
    if (!tenantId) throw new ForbiddenException('Tenant context missing');
    throw new NotFoundException('Catalog functionality disabled');
  }
}
