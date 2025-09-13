import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductPackage } from './product-package.entity';
import { User } from '../user/user.entity';
import { PackagePrice } from './package-price.entity';
import { Product } from './product.entity';

// ثابت مقياس (scale=4)
const SCALE = 10000n;

function toScaled(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) throw new Error('VALUE_REQUIRED');
  const s = String(value).trim();
  if (!s) throw new Error('VALUE_REQUIRED');
  if (!/^[-+]?\d*(?:\.\d+)?$/.test(s)) throw new Error('INVALID_NUMBER');
  const [intPart, fracRaw = ''] = s.split('.');
  const frac = (fracRaw + '0000').slice(0, 4); // pad / trim
  const sign = s.startsWith('-') ? -1n : 1n;
  const intDigits = intPart.replace(/^[-+]/, '') || '0';
  const bi = BigInt(intDigits);
  const bf = BigInt(frac);
  return sign * (bi * SCALE + bf);
}

function scaledToString(v: bigint): string {
  const sign = v < 0n ? '-' : '';
  const abs = v < 0n ? -v : v;
  const intPart = abs / SCALE;
  const frac = abs % SCALE;
  const fracStr = frac.toString().padStart(4, '0').replace(/0{1,4}$/, (m) => m.length === 4 ? '0000' : m); // keep exactly 4
  return `${sign}${intPart.toString()}.${frac.toString().padStart(4, '0')}`; // always 4 decimals
}

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(ProductPackage) private readonly packagesRepo: Repository<ProductPackage>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(PackagePrice) private readonly packagePriceRepo: Repository<PackagePrice>,
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
  ) {}

  async getEffectiveUnitPrice(params: { tenantId: string; userId: string; packageId: string }): Promise<string> {
    const { tenantId, userId, packageId } = params;
    const pkg = await this.packagesRepo.findOne({ where: { id: packageId } as any, relations: ['product', 'prices', 'prices.priceGroup'] });
    if (!pkg) throw new NotFoundException('الباقة غير موجودة');
    const product = pkg.product;
    if (!product) throw new NotFoundException('المنتج غير موجود');
    if (String((product as any).tenantId) !== tenantId || String((pkg as any).tenantId) !== tenantId) {
      throw new BadRequestException('TENANT_MISMATCH');
    }
    if (!(product.supportsCounter === true && pkg.type === 'unit')) {
      throw new BadRequestException('ERR_UNIT_NOT_SUPPORTED');
    }
    const user = await this.usersRepo.findOne({ where: { id: userId } as any, relations: ['priceGroup'] });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    if (String(user.tenantId) !== tenantId) throw new BadRequestException('TENANT_MISMATCH');

    let chosen: number | null = null;
    if (user.priceGroup) {
      const match = (pkg.prices || []).find(p => p.priceGroup?.id === user.priceGroup!.id && p.unitPrice != null);
      if (match && match.unitPrice != null && Number(match.unitPrice) > 0) {
        chosen = Number(match.unitPrice);
      }
    }
    if (chosen == null) {
      if (pkg.baseUnitPrice != null && Number(pkg.baseUnitPrice) > 0) chosen = Number(pkg.baseUnitPrice);
    }
    if (chosen == null || !(chosen > 0)) {
      throw new BadRequestException('ERR_UNIT_PRICE_MISSING');
    }
    // to scale 4 string
    return Number(chosen).toFixed(4);
  }

  validateQuantity(params: { quantity: string; minUnits?: string; maxUnits?: string; step?: string }): void {
    const { quantity, minUnits, maxUnits, step } = params;
    if (quantity == null || String(quantity).trim() === '') throw new BadRequestException('ERR_QUANTITY_REQUIRED');
    let q: bigint;
    try { q = toScaled(quantity); } catch { throw new BadRequestException('ERR_QUANTITY_REQUIRED'); }
    if (q <= 0n) throw new BadRequestException('ERR_QUANTITY_REQUIRED');
    if (minUnits != null) {
      const mn = toScaled(minUnits);
      if (q < mn) throw new BadRequestException('ERR_QTY_BELOW_MIN');
    }
    if (maxUnits != null) {
      const mx = toScaled(maxUnits);
      if (q > mx) throw new BadRequestException('ERR_QTY_ABOVE_MAX');
    }
    if (step != null) {
      const st = toScaled(step);
      if (st <= 0n) throw new BadRequestException('ERR_QTY_STEP_MISMATCH');
      const base = minUnits != null ? toScaled(minUnits) : 0n;
      const diff = q - base;
      if (diff < 0n || diff % st !== 0n) throw new BadRequestException('ERR_QTY_STEP_MISMATCH');
    }
  }

  async quoteUnitOrder(params: { tenantId: string; userId: string; packageId: string; quantity: string }): Promise<{ unitPriceApplied: string; quantity: string; sellPrice: string; cost?: string; profit?: string }> {
    const { tenantId, userId, packageId, quantity } = params;
    const pkg = await this.packagesRepo.findOne({ where: { id: packageId } as any, relations: ['product'] });
    if (!pkg) throw new NotFoundException('الباقة غير موجودة');
    const product = pkg.product;
    if (!product) throw new NotFoundException('المنتج غير موجود');
    if (!(product.supportsCounter === true && pkg.type === 'unit')) {
      throw new BadRequestException('ERR_UNIT_NOT_SUPPORTED');
    }
    // Validate quantity bounds using package fields (convert to strings if numbers)
    this.validateQuantity({
      quantity,
      minUnits: pkg.minUnits != null ? String(pkg.minUnits) : undefined,
      maxUnits: pkg.maxUnits != null ? String(pkg.maxUnits) : undefined,
      step: pkg.step != null ? String(pkg.step) : undefined,
    });
    const unitPriceApplied = await this.getEffectiveUnitPrice({ tenantId, userId, packageId });
    const qScaled = toScaled(quantity);
    const uScaled = toScaled(unitPriceApplied);
    const sellScaled = (qScaled * uScaled) / SCALE; // (qty * unit) / 10000 to keep scale=4
    let cost: string | undefined; let profit: string | undefined;
    if (pkg.capital != null && Number(pkg.capital) > 0) {
      const unitCostScaled = toScaled(Number(pkg.capital).toFixed(4));
      const costScaled = (qScaled * unitCostScaled) / SCALE;
      const profitScaled = sellScaled - costScaled;
      cost = scaledToString(costScaled);
      profit = scaledToString(profitScaled);
    }
    return {
      unitPriceApplied: uScaled === 0n ? '0.0000' : unitPriceApplied,
      quantity: Number(quantity).toFixed(4).replace(/0+$/,'').replace(/\.$/,'') || quantity,
      sellPrice: scaledToString(sellScaled),
      cost,
      profit,
    };
  }
}
