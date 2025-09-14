import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductPackage } from './product-package.entity';
import { User } from '../user/user.entity';
import { PackagePrice } from './package-price.entity';
import { Product } from './product.entity';
import { getPriceDecimals, getScaleBigInt } from '../config/pricing.config';
import { isValidDec } from './decimal.util';

// Local helpers leveraging dynamic SCALE (10 ** priceDecimals)
function toScaled(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) throw new Error('VALUE_REQUIRED');
  const s = String(value).trim();
  if (!s) throw new Error('VALUE_REQUIRED');
  if (!/^[-+]?\d*(?:\.\d+)?$/.test(s)) throw new Error('INVALID_NUMBER');
  const decimals = getPriceDecimals();
  const [intPart, fracRaw = ''] = s.split('.');
  const pad = '0'.repeat(decimals);
  const frac = (fracRaw + pad).slice(0, decimals);
  const sign = s.startsWith('-') ? -1n : 1n;
  const intDigits = intPart.replace(/^[-+]/, '') || '0';
  const bi = BigInt(intDigits);
  const bf = BigInt(frac || '0');
  return sign * (bi * getScaleBigInt() + bf);
}

function scaledToString(v: bigint): string {
  const decimals = getPriceDecimals();
  const sign = v < 0n ? '-' : '';
  const abs = v < 0n ? -v : v;
  const scaleBig = getScaleBigInt();
  const intPart = abs / scaleBig;
  const frac = abs % scaleBig;
  const fracStr = frac.toString().padStart(decimals, '0');
  return decimals > 0 ? `${sign}${intPart.toString()}.${fracStr}` : `${sign}${intPart.toString()}`;
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
    // لم يعد هناك override لكل مجموعة؛ السعر الفعلي للوحدة هو baseUnitPrice دائماً.
    if (pkg.baseUnitPrice != null && Number(pkg.baseUnitPrice) > 0) {
      chosen = Number(pkg.baseUnitPrice);
    }
    if (chosen == null || !(chosen > 0)) {
      throw new BadRequestException('ERR_UNIT_PRICE_MISSING');
    }
    return Number(chosen).toFixed(getPriceDecimals());
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
    const scaleBig = getScaleBigInt();
    const sellScaled = (qScaled * uScaled) / scaleBig; // (qty * unit) / SCALE
    let cost: string | undefined; let profit: string | undefined;
    if (pkg.capital != null && Number(pkg.capital) > 0) {
      const unitCostScaled = toScaled(Number(pkg.capital).toFixed(getPriceDecimals()));
      const costScaled = (qScaled * unitCostScaled) / scaleBig;
      const profitScaled = sellScaled - costScaled;
      cost = scaledToString(costScaled);
      profit = scaledToString(profitScaled);
    }
    const decimals = getPriceDecimals();
    return {
      unitPriceApplied: uScaled === 0n ? (decimals ? `0.${'0'.repeat(decimals)}` : '0') : unitPriceApplied,
      quantity: Number(quantity).toFixed(decimals).replace(/0+$/,'').replace(/\.$/,'') || quantity,
      sellPrice: scaledToString(sellScaled),
      cost,
      profit,
    };
  }
}
