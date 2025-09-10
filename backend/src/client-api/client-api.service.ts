import { Injectable, UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Product } from '../products/product.entity';
import { ProductPackage } from '../products/product-package.entity';
import { ProductOrder } from '../products/product-order.entity';
import { ProductsService } from '../products/products.service';
import { PackagePrice } from '../products/package-price.entity';
import { User } from '../user/user.entity';
import { ErrClientApi } from './client-api-error';
import { ProductApiMetadata } from '../products/product-api-metadata.entity';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class ClientApiService {
  constructor(
    @InjectRepository(Product) private productsRepo: Repository<Product>,
    @InjectRepository(ProductPackage) private packagesRepo: Repository<ProductPackage>,
    @InjectRepository(ProductOrder) private ordersRepo: Repository<ProductOrder>,
    @InjectRepository(PackagePrice) private packagePrices: Repository<PackagePrice>,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(ProductApiMetadata) private productMetaRepo: Repository<ProductApiMetadata>,
    @InjectDataSource() private dataSource: DataSource,
    private productsService: ProductsService,
  ) {}

  private async loadUserPriceGroup(userId: string) {
    const user = await this.usersRepo.findOne({ where: { id: userId } as any, relations: ['priceGroup'] });
    return user?.priceGroup?.id || null;
  }

  private async computePricesForUser(tenantId: string, userId: string, packages: ProductPackage[]) {
    if (!packages.length) return new Map<string, number>();
    const groupId = await this.loadUserPriceGroup(userId);
    const base = new Map<string, number>();
    for (const p of packages) base.set(p.id, Number(p.basePrice ?? p.capital ?? 0));
    if (!groupId) return base;
    const rows = await this.packagePrices.find({ where: { tenantId, package: { id: In(packages.map(p => p.id)) }, priceGroup: { id: groupId } } as any, relations: ['priceGroup','package'] });
    for (const r of rows) base.set((r as any).package.id, Number(r.price));
    return base;
  }

  private mapInternalStatus(status: string): string {
    switch (status) {
      case 'pending': return 'wait';
      case 'approved': return 'accept';
      case 'rejected': return 'reject';
      default: return 'wait';
    }
  }

  private async loadMetadataMap(productIds: string[]): Promise<Map<string, ProductApiMetadata>> {
    if (!productIds.length) return new Map();
    const rows = await this.productMetaRepo.findBy(productIds.map(id => ({ productId: id })) as any);
    const map = new Map<string, ProductApiMetadata>();
    for (const r of rows) map.set(r.productId, r);
    return map;
  }

  private buildQtyValues(meta?: ProductApiMetadata | null): any {
    if (!meta) return null; // default null
    switch (meta.qtyMode) {
      case 'null':
      case 'fixed':
        return null;
      case 'range':
        if (meta.qtyMin != null && meta.qtyMax != null) return { min: meta.qtyMin, max: meta.qtyMax };
        return null;
      case 'list':
        return Array.isArray(meta.qtyList) ? meta.qtyList.map(x => String(x)) : null;
      default:
        return null;
    }
  }

  private buildParamsList(meta?: ProductApiMetadata | null): string[] {
    if (!meta || !Array.isArray(meta.paramsSchema)) return [];
    return meta.paramsSchema
      .filter((p: any) => p && typeof p.key === 'string' && p.key.length <= 64)
      .map((p: any) => p.key);
  }

  async listProducts(tenantId: string, userId: string, opts: { filterIds?: string[]; baseOnly?: boolean } = {}) {
    const products = await this.productsRepo.find({ where: { tenantId, isActive: true } as any, relations: ['packages'] });
    const metaMap = await this.loadMetadataMap(products.map(p => p.id));
    const allPackages = products.flatMap(p => (p.packages||[]));
    const priceMap = await this.computePricesForUser(tenantId, userId, allPackages);
    const out: any[] = [];
    for (const product of products) {
      const meta = metaMap.get(product.id);
      const qtyValues = this.buildQtyValues(meta);
      const paramsList = this.buildParamsList(meta);
      for (const pkg of product.packages || []) {
        if (!pkg.isActive || !product.isActive) continue;
        const price = priceMap.get(pkg.id) || 0;
        const available = price > 0 && product.isActive && pkg.isActive;
        if (!available && !opts.baseOnly) continue; // exclude zero-priced when full listing
        // Expose package-level name so integrators can distinguish variants (e.g., PUBG 16200)
        const item = opts.baseOnly ? { id: pkg.id, name: pkg.name } : {
          id: pkg.id,
          name: pkg.name,
          product_type: 'package',
          price: price,
          available,
          qty_values: qtyValues,
          params: paramsList,
        };
        out.push(item);
      }
    }
    let filtered = out;
    if (opts.filterIds && opts.filterIds.length) {
      const set = new Set(opts.filterIds.map(x => String(x)));
      filtered = out.filter(p => set.has(String(p.id)));
    }
    return filtered;
  }

  async listContent(tenantId: string, userId: string, categoryId: string) {
    const products = await this.listProducts(tenantId, userId, {});
    return { categories: [{ id: categoryId, name: categoryId }], products };
  }

  private validateQuantity(meta: ProductApiMetadata | undefined, quantity: number) {
    const mode = meta?.qtyMode || 'null';
    if (mode === 'null' || mode === 'fixed') {
      if (quantity !== 1) throw ErrClientApi.qtyNotAllowed(); // 106
      return;
    }
    if (mode === 'range') {
      const min = meta?.qtyMin ?? 1;
      const max = meta?.qtyMax ?? min;
      if (quantity < min) throw ErrClientApi.qtyTooSmall(); // 112
      if (quantity > max) throw ErrClientApi.qtyTooLarge(); // 113
      return;
    }
    if (mode === 'list') {
      const list = (meta?.qtyList || []).map(x => Number(x));
      if (!list.includes(quantity)) throw ErrClientApi.qtyNotAllowed(); // 106
      return;
    }
    // default fallback
    if (quantity !== 1) throw ErrClientApi.qtyNotAllowed();
  }

  private validateParams(meta: ProductApiMetadata | undefined, query: Record<string, any>) {
    if (!meta || !Array.isArray(meta.paramsSchema)) return;
    for (const p of meta.paramsSchema) {
      if (!p || typeof p.key !== 'string') continue;
      const key = p.key;
      const val = query[key];
      if (p.required && (val === undefined || val === null || val === '')) throw ErrClientApi.missingParam(key);
      if (val === undefined || val === null || val === '') continue; // optional absent fine
      // type check (only string/int/number for now; treat default as string)
      let strVal = String(val);
      if (p.type === 'number' || p.type === 'int') {
        if (!/^[-]?[0-9]+$/.test(strVal)) throw ErrClientApi.invalidParam(key);
        const num = Number(strVal);
        if (p.min !== undefined && num < p.min) throw ErrClientApi.invalidParam(key);
        if (p.max !== undefined && num > p.max) throw ErrClientApi.invalidParam(key);
      } else {
        // string rules
        if (p.min !== undefined && strVal.length < p.min) throw ErrClientApi.invalidParam(key);
        if (p.max !== undefined && strVal.length > p.max) throw ErrClientApi.invalidParam(key);
        if (p.pattern) {
          try {
            const re = new RegExp(p.pattern);
            if (!re.test(strVal)) throw ErrClientApi.invalidParam(key);
          } catch { throw ErrClientApi.invalidParam(key); }
        }
        if (Array.isArray(p.enum)) {
          if (!p.enum.map((e: any) => String(e)).includes(strVal)) throw ErrClientApi.invalidParam(key);
        }
      }
    }
  }

  async createOrder(opts: { tenantId: string; userId: string; productId: string; orderUuid?: string | null; quantity: number; userIdentifier?: string | null; extraField?: string | null; rawQuery?: any; }) {
    // Quantity normalization
    if (!Number.isInteger(opts.quantity)) throw ErrClientApi.qtyNotAllowed();
    if (opts.quantity <= 0) throw ErrClientApi.qtyTooSmall();
    if (opts.quantity > 1_000_000) throw ErrClientApi.qtyTooLarge();
    const pkg = await this.packagesRepo.findOne({ where: { id: opts.productId, tenantId: opts.tenantId } as any, relations: ['product'] });
    if (!pkg || !(pkg as any).product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
    const priceMap = await this.computePricesForUser(opts.tenantId, opts.userId, [pkg]);
    const price = priceMap.get(pkg.id) || 0;
    if (price <= 0) throw ErrClientApi.productUnavailable();
    const product = (pkg as any).product as Product;

    // Load metadata for product
    const meta = await this.productMetaRepo.findOne({ where: { productId: product.id } as any });

    // Quantity rules from metadata
    this.validateQuantity(meta || undefined, opts.quantity);

    // Params validation
    this.validateParams(meta || undefined, opts.rawQuery || {});

    if (opts.orderUuid) {
      const existing = await this.ordersRepo.findOne({ where: { tenantId: opts.tenantId, orderUuid: opts.orderUuid } as any });
      if (existing) return { reused: true, order: existing };
    }

  const order = this.ordersRepo.create({
      tenantId: opts.tenantId,
      product,
      package: pkg,
      user: { id: opts.userId } as any,
      quantity: opts.quantity,
      orderUuid: opts.orderUuid || null,
      status: 'pending',
    });
    await this.ordersRepo.save(order);
    return { order };
  }

  /** Unified creation path used by /client/api/newOrder now mapped to packageId */
  async createUnifiedClientOrder(opts: { tenantId: string; userId: string; packageId: string; orderUuid: string | null; quantity: number; userIdentifier: string | null; extraField: string | null; rawQuery: any; }) {
    // Load package & product for metadata validations
    const pkg = await this.packagesRepo.findOne({ where: { id: opts.packageId, tenantId: opts.tenantId } as any, relations: ['product'] });
    if (!pkg || !(pkg as any).product) throw new NotFoundException({ code: 'NOT_FOUND', message: 'NOT_FOUND' });
    const product = (pkg as any).product as Product;
    const meta = await this.productMetaRepo.findOne({ where: { productId: product.id } as any });
    // Quantity & params validation (reuse helpers)
    this.validateQuantity(meta || undefined, opts.quantity);
    this.validateParams(meta || undefined, opts.rawQuery || {});
    // Use unified productsService path (now supports idempotency + origin)
  const unified = await this.productsService.createOrder({
      productId: product.id,
      packageId: pkg.id,
      quantity: opts.quantity,
      userId: opts.userId,
      userIdentifier: opts.userIdentifier || undefined,
      extraField: opts.extraField || undefined,
      orderUuid: opts.orderUuid || null,
      origin: 'client_api',
    }, opts.tenantId);

    const reused = (unified as any).reused === true;

    // Try to include provider note/pin if available immediately after auto-dispatch
    let orderRow: ProductOrder | null = null;
    try {
      orderRow = await this.ordersRepo.findOne({ where: { id: unified.id, tenantId: opts.tenantId } as any });
    } catch {}
    const noteMsg: string | null =
      ((orderRow as any)?.providerMessage as any) || ((orderRow as any)?.lastMessage as any) || null;
    const pin: string | null = ((orderRow as any)?.pinCode as any) || null;

    return {
      reused,
      id: unified.id,
      order_uuid: (unified as any).order_uuid || opts.orderUuid || null,
      status: unified.status === 'pending' ? 'wait' : (unified.status === 'approved' ? 'accept' : 'reject'),
      quantity: unified.quantity,
      price_usd: unified.priceUSD,
      unit_price_usd: unified.unitPriceUSD,
      created_at: unified.createdAt,
      origin: (unified as any).origin || 'client_api',
      // Optional extras for integrators: note/message + pin when present
      ...(noteMsg ? { note: String(noteMsg).slice(0, 500), message: String(noteMsg).slice(0, 500) } : {}),
      ...(pin ? { pin } : {}),
    };
  }

  async checkOrder(tenantId: string, userId: string, orderId: string) {
    const order = await this.ordersRepo.findOne({ where: { id: orderId, tenantId } as any });
    if (!order) return null;
    if ((order as any).user?.id && (order as any).user.id !== userId) return null;
    return order;
  }

  async checkOrderByUuid(tenantId: string, userId: string, orderUuid: string) {
    const order = await this.ordersRepo.findOne({ where: { tenantId, orderUuid } as any });
    if (!order) return null;
    if ((order as any).user?.id && (order as any).user.id !== userId) return null;
    return order;
  }

  toPublic(order: ProductOrder) {
    return {
      id: order.id,
      order_uuid: order.orderUuid,
      status: this.mapInternalStatus(order.status),
      quantity: order.quantity,
      created_at: order.createdAt?.toISOString?.() || new Date().toISOString(),
      // Include provider note/message and PIN if available to help integrators
      ...(order as any)?.providerMessage
        ? { note: (order as any).providerMessage, message: (order as any).providerMessage }
        : (order as any)?.lastMessage
        ? { note: (order as any).lastMessage, message: (order as any).lastMessage }
        : {},
      ...((order as any)?.pinCode ? { pin: (order as any).pinCode } : {}),
    };
  }
}
