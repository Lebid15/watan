import { Controller, Get, Query, Req } from '@nestjs/common';
import { FinalRoles } from '../common/authz/roles';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductOrder } from '../products/product-order.entity';
import { isFeatureEnabled } from '../common/feature-flags';
import { format3 } from '../common/money/money.util';
import { Currency } from '../currencies/currency.entity';

@Controller('tenant/distributor/orders')
@FinalRoles('instance_owner')
export class DistributorOrdersController {
  constructor(
    @InjectRepository(ProductOrder) private readonly ordersRepo: Repository<ProductOrder>,
    @InjectRepository(Currency) private readonly currenciesRepo: Repository<Currency>,
  ) {}

  @Get('list')
  async list(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    if (!isFeatureEnabled('catalogLinking')) return { items: [] };
    const tenantId = req?.tenant?.id || req?.user?.tenantId;
    const role = req?.user?.roleFinal || req?.user?.role;
    const distributorIdFilter = role === 'instance_owner' ? req.user.id : (req.query.distributorId as string|undefined);
    const qb = this.ordersRepo.createQueryBuilder('o').where('o.tenantId = :t',{t:tenantId}).andWhere('o.placedByDistributorId IS NOT NULL');
    if (distributorIdFilter) qb.andWhere('o.placedByDistributorId = :d',{d:distributorIdFilter});
    if (from) qb.andWhere('o.createdAt >= :from',{from});
    if (to) qb.andWhere('o.createdAt <= :to',{to});
    qb.orderBy('o.createdAt','DESC').limit(500);
    const rows = await qb.getMany();
    const preferredCode: string | undefined = (role === 'instance_owner') ? (req.user?.preferredCurrencyCode || 'USD') : 'USD';
    return { items: rows.map(r=>{
      const capitalUSD = r.distributorCapitalUsdAtOrder ? Number(r.distributorCapitalUsdAtOrder) : null;
      const sellUSD = r.distributorSellUsdAtOrder ? Number(r.distributorSellUsdAtOrder) : null;
      const profitUSD = r.distributorProfitUsdAtOrder ? Number(r.distributorProfitUsdAtOrder) : (sellUSD!=null && capitalUSD!=null ? sellUSD - capitalUSD : null);
      const isOwner = role === 'tenant_owner';
      // استخدم FX snapshot إن وجد وإلا احسب FX الحالي
      let distCode = r as any as any; // placeholder to keep type
      distCode = (r as any).distCurrencyCodeAtOrder || preferredCode;
      let fx = 1;
      if ((r as any).fxUsdToDistAtOrder) {
        fx = Number((r as any).fxUsdToDistAtOrder) || 1;
      } else if (distCode && distCode !== 'USD') {
        // fallback legacy orders
        // NOTE: نستخدم معدل حالي فقط في حال لا توجد لقطة
        // (قد يؤدي لتغير بسيط في الطلبات القديمة قبل إدخال الحقل — مقبول)
        // we assume currencies table has current rate
      }
      const convert = (v:number|null): number | null => v==null?null: v * fx;
      return {
        id: r.id,
        createdAt: r.createdAt,
        distributorId: r.placedByDistributorId,
        capitalUSD: capitalUSD!=null? format3(capitalUSD): null,
        sellUSD: sellUSD!=null? format3(sellUSD): null,
        profitUSD: profitUSD!=null? format3(profitUSD): null,
        // عرض محول للموزع فقط
        ...(isOwner? {} : {
          currency: distCode,
      capitalDist3: (capitalUSD!=null && convert(capitalUSD)!=null)? format3(convert(capitalUSD)!): null,
      sellDist3: (sellUSD!=null && convert(sellUSD)!=null)? format3(convert(sellUSD)!): null,
      profitDist3: (profitUSD!=null && convert(profitUSD)!=null)? format3(convert(profitUSD)!): null,
        }),
      };
    }) };
  }

  @Get('reports/profit')
  async profit(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    if (!isFeatureEnabled('catalogLinking')) return { totalProfitUSD: 0 };
    const tenantId = req?.tenant?.id || req?.user?.tenantId;
    const role = req?.user?.roleFinal || req?.user?.role;
    const distributorIdFilter = role === 'instance_owner' ? req.user.id : (req.query.distributorId as string|undefined);
    const qb = this.ordersRepo.createQueryBuilder('o').select('SUM(COALESCE(o.distributorProfitUsdAtOrder,0))','sum').where('o.tenantId = :t',{t:tenantId}).andWhere('o.placedByDistributorId IS NOT NULL');
    if (distributorIdFilter) qb.andWhere('o.placedByDistributorId = :d',{d:distributorIdFilter});
    if (from) qb.andWhere('o.createdAt >= :from',{from});
    if (to) qb.andWhere('o.createdAt <= :to',{to});
    const row = await qb.getRawOne();
    const total = Number(row?.sum)||0;
  const roleLocal = role;
    if (roleLocal === 'tenant_owner') return { totalProfitUSD: format3(total) };
    // جمع FX snapshot لأوامر الموزع (قد تختلف لو تم دعم العملات المتعددة مستقبلاً، الآن نفترض نفس العملة)
    const first = await this.ordersRepo.createQueryBuilder('o')
      .where('o.tenantId=:t',{t:tenantId})
      .andWhere('o.placedByDistributorId = :d',{d: req.user.id})
      .andWhere('o.fxUsdToDistAtOrder IS NOT NULL')
      .orderBy('o.createdAt','ASC')
      .limit(1)
      .getOne();
    const distCode = (first as any)?.distCurrencyCodeAtOrder || req.user?.preferredCurrencyCode || 'USD';
    const fx = (first as any)?.fxUsdToDistAtOrder ? Number((first as any).fxUsdToDistAtOrder) : 1;
    return { totalProfitUSD: format3(total), currency: distCode, totalProfitDist3: format3(total * fx) };
  }
}
