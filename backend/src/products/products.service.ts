// src/products/products.service.ts
import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Brackets } from 'typeorm';
import { Product } from './product.entity';
import { ProductPackage } from './product-package.entity';
import { PackagePrice } from './package-price.entity';
import { PriceGroup } from './price-group.entity';
import { ProductOrder } from './product-order.entity';
import { User } from '../user/user.entity';
import { DistributorPackagePrice, DistributorUserPriceGroup } from '../distributor/distributor-pricing.entities';
import { Currency } from '../currencies/currency.entity';
import { ListOrdersDto } from './dto/list-orders.dto';
import { InternalOrderStatus } from './product-order.entity';
import { decodeCursor, encodeCursor, toEpochMs } from '../utils/pagination';
import { isFeatureEnabled } from '../common/feature-flags';
import { IntegrationsService } from '../integrations/integrations.service';
import { AccountingPeriodsService } from '../accounting/accounting-periods.service';
import { NotificationsService } from '../notifications/notifications.service';

export type OrderStatus = 'pending' | 'approved' | 'rejected' | 'processing' | 'sent';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
    @InjectRepository(ProductPackage) private readonly packagesRepo: Repository<ProductPackage>,
    @InjectRepository(PackagePrice) private readonly packagePriceRepo: Repository<PackagePrice>,
    @InjectRepository(PriceGroup) private readonly priceGroupsRepo: Repository<PriceGroup>,
    @InjectRepository(ProductOrder) private readonly ordersRepo: Repository<ProductOrder>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(DistributorPackagePrice) private readonly distPkgPriceRepo: Repository<DistributorPackagePrice>,
    @InjectRepository(DistributorUserPriceGroup) private readonly distUserGroupRepo: Repository<DistributorUserPriceGroup>,
    @InjectRepository(Currency) private readonly currenciesRepo: Repository<Currency>,
    private readonly integrations: IntegrationsService,
    private readonly accounting: AccountingPeriodsService,
    private readonly notifications: NotificationsService,
  ) {}

  async listOrdersForAdmin(query: any, tenantId?: string) {
    // NOTE: Admin هنا تعني مالك التينانت (INSTANCE_OWNER) فقط حسب الطلب.
    // ندعم: status, q (رقم طلب أو بريد/يوزر), from/to بتاريخ YYYY-MM-DD, method(مزود/يدوي), limit, cursor
    const dto: ListOrdersDto = query || {};
    const limit = Math.min(Math.max(Number(dto.limit) || 25, 1), 100);

    // فك المؤشر (cursor = createdAt|id بصيغة epochMs:id)
    let cursorCreatedAt: number | null = null;
    let cursorId: string | null = null;
    if (dto.cursor) {
      const decoded = decodeCursor(dto.cursor);
      if (decoded) {
        cursorCreatedAt = decoded.ts;
        cursorId = decoded.id;
      }
    }

    // تحميل العملات للتينانت للحساب TRY
    const currencies = await (tenantId
      ? this.currenciesRepo.find({ where: { tenantId } as any })
      : this.currenciesRepo.find());
    const getRate = (code: string) => {
      const row = currencies.find(
        (c) => c.code.toUpperCase() === code.toUpperCase(),
      );
      return row ? Number(row.rate) : undefined;
    };
    const TRY_RATE = getRate('TRY') ?? 1;
    const toTRY = (amount: number, code?: string) => {
      const c = (code || 'TRY').toUpperCase();
      if (c === 'TRY') return amount;
      const r = getRate(c);
      if (!r || !Number.isFinite(r) || r <= 0) return amount;
      return amount * (TRY_RATE / r);
    };

    const pickImage = (obj: any): string | null => {
      if (!obj) return null;
      return (
        obj.imageUrl ||
        obj.image ||
        obj.logoUrl ||
        obj.iconUrl ||
        obj.icon ||
        null
      );
    };

    // مقدمي الخدمة (قد نحتاج نوع المزود لتطبيع التكلفة الخارجية)
    const integrations = await this.integrations.list(String(tenantId));
    const providersMap = new Map<string, string>();
    for (const it of integrations as any[]) providersMap.set(it.id, it.provider);

    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'user')
      .leftJoinAndSelect('user.currency', 'currency')
      .leftJoinAndSelect('o.product', 'product')
      .leftJoinAndSelect('o.package', 'package')
      .where('o.tenantId = :tid', { tid: tenantId })
      .orderBy('o.createdAt', 'DESC')
      .addOrderBy('o.id', 'DESC');

    if (dto.status) qb.andWhere('o.status = :status', { status: dto.status });

    if (dto.q) {
      const q = dto.q.trim();
      if (/^\d+$/.test(q)) {
        // بحث برقم الطلب
        qb.andWhere('(o."orderNo" = :qInt OR o.id = :qId)', { qInt: Number(q), qId: q });
      } else {
        qb.andWhere(
          new Brackets((b) => {
            b.where('LOWER(user.email) LIKE :q').orWhere('LOWER(user.username) LIKE :q');
          }),
          { q: `%${q.toLowerCase()}%` },
        );
      }
    }

    if (dto.from) qb.andWhere('DATE(o.createdAt) >= :from', { from: dto.from });
    if (dto.to) qb.andWhere('DATE(o.createdAt) <= :to', { to: dto.to });

    if (dto.method) {
      if (dto.method === 'manual') {
        qb.andWhere('o.providerId IS NULL');
      } else if (dto.method !== '') {
        qb.andWhere('o.providerId = :pid', { pid: dto.method });
      }
    }

    if (cursorCreatedAt && cursorId) {
      qb.andWhere(
        '(o.createdAt < :cAt OR (o.createdAt = :cAt AND o.id < :cId))',
        { cAt: new Date(cursorCreatedAt), cId: cursorId },
      );
    }

    qb.take(limit + 1); // لجلب عنصر زائد لمعرفة hasMore

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    // جمع IDs الموافقَة للحصول على اللقطات المجمدة (كما في getAllOrders)
    const approvedIds = slice.filter((o) => o.status === 'approved').map((o) => o.id);
    let frozenMap = new Map<string, any>();
    if (approvedIds.length) {
      const snapRows = await this.ordersRepo.query(
        `SELECT id, COALESCE("fxLocked", false) AS "fxLocked", "sellTryAtApproval", "costTryAtApproval", "profitTryAtApproval", "approvedLocalDate"
         FROM "product_orders" WHERE id = ANY($1::uuid[])`,
        [approvedIds],
      );
      frozenMap = new Map(snapRows.map((r: any) => [String(r.id), r]));
    }

    const items = slice.map((order) => {
      const priceUSD = Number(order.price) || 0;
      const unitPriceUSD = order.quantity ? priceUSD / Number(order.quantity) : priceUSD;
      const providerType = order.providerId ? providersMap.get(order.providerId) : undefined;
      const isExternal = !!(order.providerId && order.externalOrderId);
      const frozen = frozenMap.get(order.id);
      const isFrozen = !!(frozen && frozen.fxLocked && order.status === 'approved');

      let sellTRY: number; let costTRY: number; let profitTRY: number;
      if (isFrozen) {
        sellTRY = Number(frozen.sellTryAtApproval ?? 0);
        costTRY = Number(frozen.costTryAtApproval ?? 0);
        const profitFrozenRaw = frozen.profitTryAtApproval != null
          ? Number(frozen.profitTryAtApproval)
          : sellTRY - costTRY;
        sellTRY = Number(sellTRY.toFixed(2));
        costTRY = Number(costTRY.toFixed(2));
        profitTRY = Number(profitFrozenRaw.toFixed(2));
      } else {
        if (isExternal) {
          const amt = Math.abs(Number(order.costAmount ?? 0));
            let cur = String(order.costCurrency || '').toUpperCase().trim();
            if (providerType === 'znet') cur = 'TRY';
            if (!cur) cur = 'USD';
            costTRY = toTRY(amt, cur);
        } else {
          const baseUSD = Number((order as any).package?.basePrice ?? (order as any).package?.capital ?? 0);
          const qty = Number(order.quantity ?? 1);
          costTRY = baseUSD * qty * TRY_RATE;
        }
        sellTRY = priceUSD * TRY_RATE;
        profitTRY = sellTRY - costTRY;
        sellTRY = Number(sellTRY.toFixed(2));
        costTRY = Number(costTRY.toFixed(2));
        profitTRY = Number(profitTRY.toFixed(2));
      }

      const userRate = order.user?.currency ? Number(order.user.currency.rate) : 1;
      const userCode = order.user?.currency ? order.user.currency.code : 'USD';
      const totalUser = priceUSD * userRate;
      const unitUser = unitPriceUSD * userRate;

      const sellUsdSnap = (order as any).sellUsdAtOrder != null ? Number((order as any).sellUsdAtOrder) : priceUSD;
      const costUsdSnap = (order as any).costUsdAtOrder != null ? Number((order as any).costUsdAtOrder) : null;
      const profitUsdSnap = (order as any).profitUsdAtOrder != null
        ? Number((order as any).profitUsdAtOrder)
        : (costUsdSnap != null ? Number((sellUsdSnap - costUsdSnap).toFixed(4)) : null);

      return {
        id: order.id,
        orderNo: (order as any).orderNo ?? null,
        username: (order.user as any)?.username ?? null,
        status: order.status,
        externalStatus: (order as any).externalStatus,
        externalOrderId: order.externalOrderId ?? null,
        providerId: order.providerId ?? null,
        quantity: order.quantity,
        price: totalUser,
        currencyCode: userCode,
        unitPrice: unitUser,
  priceUSD: sellUsdSnap, // استخدم اللقطة الثابتة لعرض USD
  unitPriceUSD: order.quantity ? sellUsdSnap / Number(order.quantity) : sellUsdSnap,
        display: { currencyCode: userCode, unitPrice: unitUser, totalPrice: totalUser },
        currencyTRY: 'TRY',
        sellTRY, costTRY, profitTRY,
  sellUsdAtOrder: sellUsdSnap,
  costUsdAtOrder: costUsdSnap,
  profitUsdAtOrder: profitUsdSnap,
        costAmount: order.costAmount ?? null,
        costCurrency: order.costCurrency ?? null,
        fxLocked: isFrozen,
        approvedLocalDate: frozen?.approvedLocalDate ?? null,
        sentAt: order.sentAt ? order.sentAt.toISOString() : null,
        lastSyncAt: (order as any).lastSyncAt ? (order as any).lastSyncAt.toISOString() : null,
        completedAt: order.completedAt ? order.completedAt.toISOString() : null,
        createdAt: order.createdAt.toISOString(),
        userEmail: order.user?.email || 'غير معروف',
        extraField: (order as any).extraField ?? null,
        product: { id: order.product?.id, name: order.product?.name, imageUrl: pickImage((order as any).product) },
        package: { id: order.package?.id, name: order.package?.name, imageUrl: pickImage((order as any).package) },
        providerMessage: (order as any).providerMessage ?? (order as any).lastMessage ?? null,
        pinCode: (order as any).pinCode ?? null,
        notesCount: Array.isArray((order as any).notes) ? (order as any).notes.length : 0,
        manualNote: (order as any).manualNote ?? null,
        lastMessage: (order as any).lastMessage ?? null,
      };
    });

    const nextCursor = hasMore
      ? encodeCursor(slice[slice.length - 1].createdAt.getTime(), slice[slice.length - 1].id)
      : null;

    return {
      items,
      pageInfo: { hasMore, nextCursor },
      meta: { count: items.length },
    };
  }

  // معرف التينانت الخاص بالمطور (مستودع عالمي)
  private readonly DEV_TENANT_ID = '00000000-0000-0000-0000-000000000000';

  // Helper: fetch single package by id (lightweight)
  async findPackageById(id: string): Promise<ProductPackage | null> {
    if (!id) return null;
    return this.packagesRepo.findOne({ where: { id } as any });
  }

  // ✅ تحديث اسم المزود لباقات المنتج
  async updatePackageProvider(packageId: string, providerName: string) {
    const pkg = await this.packagesRepo.findOne({ where: { id: packageId } as any });
    if (!pkg) throw new NotFoundException('الباقة غير موجودة');
    (pkg as any).providerName = providerName;
    await this.packagesRepo.save(pkg);
    return { id: pkg.id, providerName };
  }

  /** ✅ حذف باقة (مع أسعارها) مع دعم الحذف العالمي للمطور */
  async deletePackage(context: { tenantId?: string | null; role?: string | null; userId?: string | null }, id: string): Promise<void> {
    const { tenantId, role, userId } = context || {};
    const pkg = await this.packagesRepo.findOne({ where: { id } as any, relations: ['prices', 'product'] });
    if (!pkg) throw new NotFoundException('لم يتم العثور على الباقة');

    const isGlobal = pkg.tenantId === this.DEV_TENANT_ID;
    const roleLower = (role || '').toLowerCase();
    const isDevRole = roleLower === 'developer' || roleLower === 'instance_owner';

    console.log('[PKG][DELETE][REQ]', {
      packageId: id,
      pkgTenantId: pkg.tenantId,
      reqTenantId: tenantId || null,
      isGlobal,
      role: roleLower || null,
      userId: userId?.slice(0,8) || null,
    });

    if (tenantId && pkg.tenantId === tenantId) {
      // ok
    } else if (isGlobal && isDevRole) {
      // allow
    } else {
      throw new ForbiddenException('لا تملك صلاحية حذف هذه الباقة');
    }

    if (Array.isArray(pkg.prices) && pkg.prices.length) {
      await this.packagePriceRepo.remove(pkg.prices);
    }
    await this.packagesRepo.remove(pkg);
  }

  // ---------- Helpers خاصة بالـ tenant ----------
  private ensureSameTenant(
    entityTenantId?: string | null,
    expectedTenantId?: string,
  ) {
    if (!expectedTenantId) return; // لا تحقق إن لم يُطلب تقييد
    if (!entityTenantId)
      throw new ForbiddenException('هذا السجل غير مرتبط بأي مستأجر');
    if (entityTenantId !== expectedTenantId)
      throw new ForbiddenException('لا تملك صلاحية على هذا المستأجر');
  }

  private addTenantWhere(qb: any, alias: string, tenantId?: string) {
    if (tenantId) qb.andWhere(`${alias}."tenantId" = :tid`, { tid: tenantId });
  }

  // ===== Helper: تطبيع حالة المزود إلى done/failed/processing/sent مع دعم 1/2/3 =====
  private normalizeExternalStatus(
    raw?: string,
  ): 'done' | 'failed' | 'processing' | 'sent' {
    const s = (raw || '').toString().toLowerCase().trim();
    if (['2', 'success', 'ok', 'done', 'completed', 'complete'].includes(s))
      return 'done';
    if (
      [
        '3',
        'failed',
        'fail',
        'error',
        'rejected',
        'cancelled',
        'canceled',
      ].includes(s)
    )
      return 'failed';
    if (['accepted', 'sent', 'queued', 'queue'].includes(s)) return 'sent';
    return 'processing';
  }

  // ===== ✅ المزامنة اليدوية مع المزود + التقاط note/pin (مقيّدة بالـ tenant إن مرّ) =====
  async syncExternal(
    orderId: string,
    tenantId?: string,
  ): Promise<{
    order: ProductOrder;
    extStatus: 'done' | 'failed' | 'processing' | 'sent';
    note?: string;
    pin?: string;
  }> {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId } as any,
      relations: ['user', 'package', 'product'],
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    this.ensureSameTenant((order as any).user?.tenantId, tenantId);

    if (!order.providerId || !order.externalOrderId) {
      throw new BadRequestException('الطلب غير مرسل خارجيًا');
    }

    // ✅ استنتج tenantId فعّال
    const effectiveTenantId = String(
      tenantId ?? (order as any)?.user?.tenantId,
    );
    // إن أردت التشديد:
    // if (!effectiveTenantId) throw new BadRequestException('tenantId is required');

    const alreadyTerminal =
      order.externalStatus === 'done' ||
      order.externalStatus === 'failed' ||
      order.status === 'approved' ||
      order.status === 'rejected';

    // ✅ مرّر tenantId حسب التوقيع الجديد
    const res = await this.integrations.checkOrders(
      order.providerId,
      effectiveTenantId,
      [order.externalOrderId],
    );
    const first: any = Array.isArray(res) ? res[0] : res;

    let statusRaw: string | undefined = first?.mappedStatus;
    if (!statusRaw) {
      const code = String(first?.providerStatus ?? '').trim();
      if (code === '1') statusRaw = 'pending';
      else if (code === '2') statusRaw = 'success';
      else if (code === '3') statusRaw = 'failed';
    }
    statusRaw =
      statusRaw ??
      first?.status ??
      first?.state ??
      first?.orderStatus ??
      first?.providerStatus ??
      'processing';

    const extStatus = this.normalizeExternalStatus(statusRaw);
    console.log('[SERVICE syncExternal] provider reply', {
      orderId: order.id,
      providerId: order.providerId,
      externalOrderId: order.externalOrderId,
      mapped: statusRaw,
      normalized: extStatus,
      note: first?.note || first?.raw?.message || first?.raw?.desc || null,
      pin: first?.pin || first?.raw?.pin || null,
    });

    const note: string | undefined =
      first?.note?.toString?.().trim?.() ||
      first?.raw?.desc?.toString?.().trim?.() ||
      first?.raw?.note?.toString?.().trim?.() ||
      first?.raw?.message?.toString?.().trim?.() ||
      first?.raw?.text?.toString?.().trim?.();

    const pin: string | undefined =
      first?.pin != null
        ? String(first.pin).trim()
        : first?.raw?.pin != null
          ? String(first.raw.pin).trim()
          : undefined;

    order.externalStatus = extStatus as any;
    order.lastSyncAt = new Date();
    order.lastMessage =
      String(note || first?.raw?.message || first?.raw?.desc || 'sync').slice(
        0,
        250,
      ) || null;
    if (pin) order.pinCode = pin;

    const nowIso = new Date().toISOString();
    if (note && note.trim()) {
      const arr = Array.isArray(order.notes) ? order.notes : [];
      arr.push({ by: 'system', text: note, at: nowIso });
      order.notes = arr as any;
      (order as any).providerMessage = note;
      (order as any).notesCount = arr.length;
    }

    const isTerminal = extStatus === 'done' || extStatus === 'failed';

    if (isTerminal) {
      order.completedAt = new Date();
      order.durationMs = order.sentAt
        ? order.completedAt.getTime() - order.sentAt.getTime()
        : 0;
      await this.ordersRepo.save(order);

      if (extStatus === 'done') {
        await this.updateOrderStatus(order.id, 'approved', effectiveTenantId);
      } else {
        await this.updateOrderStatus(order.id, 'rejected', effectiveTenantId);
      }
    }


    return { order, extStatus, note, pin };
  }

  async updateImage(
    tenantId: string,
    id: string,
    imageUrl: string,
  ): Promise<Product> {
    const product = await this.productsRepo.findOne({
      where: { id, tenantId } as any,
    });
    if (!product) throw new NotFoundException('Product not found');
  // Store into customImageUrl (catalog system removed)
  (product as any).customImageUrl = imageUrl;
    return this.productsRepo.save(product);
  }

  async findAllWithPackages(tenantId?: string): Promise<any[]> {
    // Dev fallback: إذا لم يوجد tenantId (صفحة /dev من الدومين الرئيسي أو بدون تسجيل دخول)
    // سابقاً: كان يتم إرجاع كل المنتجات لكل التينانت مما سبب التباس بأن منتجات المستأجر تظهر كأنها "عالمية".
    // الآن: نقيّد العرض إلى الحاوية العالمية فقط (DEV_TENANT_ID) عند غياب tenantId.
    if (!tenantId) {
      const products = await this.productsRepo.find({
        where: { tenantId: this.DEV_TENANT_ID } as any,
        relations: ['packages'],
        take: 500,
        order: { name: 'ASC' } as any,
      });
      console.log('[PRODUCTS][LIST][NO-TENANT] returned', products.length, 'global products');
      return products.map((product: any) => {
        const mapped = this.mapEffectiveImage(product);
        return {
          ...product,
          ...mapped,
          packages: (product.packages || []).map((pkg: any) => ({
            ...pkg,
            basePrice: pkg.basePrice ?? pkg.capital ?? 0,
            prices: [],
          })),
        };
      });
    }

    // السياق الطبيعي: مقيّد بالتينانت (لا fallback تلقائي للمنتجات العالمية الآن)
    const products = await this.productsRepo.find({
      where: { tenantId } as any,
      relations: ['packages', 'packages.prices', 'packages.prices.priceGroup'],
    });

    const allPriceGroups = await this.priceGroupsRepo.find({
      where: { tenantId } as any,
    });
    return products.map((product) => {
      const mapped = this.mapEffectiveImage(product as any);
      return {
        ...product,
        ...mapped,
        packages: (product.packages || []).map((pkg) => ({
          ...pkg,
          basePrice: pkg.basePrice ?? pkg.capital ?? 0,
          prices: allPriceGroups.map((group) => {
            const existingPrice = (pkg.prices || []).find(
              (price) => price.priceGroup?.id === group.id,
            );
            return {
              id: existingPrice?.id ?? null,
              groupId: group.id,
              groupName: group.name,
              price: existingPrice?.price ?? 0,
            };
          }),
        })),
      };
    });
  }

  // ===== ✅ استنساخ منتج عالمي (الحاوية العامة) إلى تينانت مستهدف =====
  async cloneGlobalProductToTenant(globalProductId: string, targetTenantId: string): Promise<Product> {
    const GLOBAL_ID = this.DEV_TENANT_ID; // نفس المعرف المستخدم كحاوية عالمية
    // احضار المنتج العالمي مع باقاته
    const source = await this.productsRepo.findOne({
      where: { id: globalProductId, tenantId: GLOBAL_ID } as any,
      relations: ['packages'],
    });
    if (!source) throw new NotFoundException('المنتج العالمي غير موجود');

    // فلترة الباقات الصالحة (نشطة ولها publicCode)
    const validPkgs = (source.packages || []).filter((p: any) => p.isActive && p.publicCode != null);
    if (validPkgs.length === 0) {
      throw new UnprocessableEntityException('لا توجد باقات نشطة ذات publicCode لنسخها');
    }

    // معالجة تعارض الاسم داخل التينانت المستهدف
    const baseName = source.name?.trim() || 'منتج';
    let candidate = baseName;
    const MAX_TRIES = 12;
    for (let i = 0; i < MAX_TRIES; i++) {
      const exists = await this.productsRepo.findOne({ where: { tenantId: targetTenantId, name: candidate } as any });
      if (!exists) break;
      const suffix = i + 2; // يبدأ من -2
      candidate = `${baseName}-${suffix}`;
      if (i === MAX_TRIES - 1) {
        throw new ConflictException('تعذر إيجاد اسم متاح بعد محاولات متعددة');
      }
    }

    // إنشاء المنتج الجديد
  const newProduct = new Product();
  newProduct.tenantId = targetTenantId;
  newProduct.name = candidate;
  newProduct.description = source.description || undefined;
  // حفظ مرجع المنتج العالمي الأصلي
  (newProduct as any).sourceGlobalProductId = source.id;
  (newProduct as any).customImageUrl = (source as any).customImageUrl || undefined;
  (newProduct as any).customAltText = (source as any).customAltText || undefined;
  (newProduct as any).thumbSmallUrl = (source as any).thumbSmallUrl || undefined;
  (newProduct as any).thumbMediumUrl = (source as any).thumbMediumUrl || undefined;
  (newProduct as any).thumbLargeUrl = (source as any).thumbLargeUrl || undefined;
  newProduct.isActive = true;
  const savedProduct = await this.productsRepo.save(newProduct);

    // نسخ الباقات
    const clones: ProductPackage[] = [];
    for (const pkg of validPkgs) {
  const clone = new ProductPackage();
  clone.tenantId = targetTenantId;
  clone.publicCode = pkg.publicCode;
  clone.name = pkg.name;
  clone.description = pkg.description || undefined;
  clone.imageUrl = pkg.imageUrl || undefined;
  clone.basePrice = (pkg.basePrice ?? pkg.capital ?? 0) as any;
  clone.capital = (pkg.capital ?? pkg.basePrice ?? 0) as any;
  clone.providerName = pkg.providerName || undefined;
  clone.isActive = true;
  clone.product = savedProduct;
  const savedClone = await this.packagesRepo.save(clone);
      clones.push(savedClone);
    }
    (savedProduct as any).packages = clones;
    return savedProduct;
  }

  // ===== ✅ قائمة المنتجات العالمية مع عدد الباقات النشطة ذات publicCode =====
  async listGlobalProducts(): Promise<any[]> {
    const GLOBAL_ID = this.DEV_TENANT_ID;
    const rows = await this.productsRepo.find({
      where: { tenantId: GLOBAL_ID } as any,
      relations: ['packages'],
      order: { name: 'ASC' } as any,
      take: 800,
    });
    return rows
      .map((product: any) => {
        const mapped = this.mapEffectiveImage(product);
        // Original logic required publicCode which caused empty list if seed packages lack codes.
        const activeAll = (product.packages || []).filter((p: any) => p.isActive);
        const activeWithCode = activeAll.filter((p: any) => p.publicCode != null);
        return {
          id: product.id,
          name: product.name,
          packagesActiveCount: activeAll.length,
          packagesActiveWithCode: activeWithCode.length,
          hasAny: activeAll.length > 0,
          hasAnyWithCode: activeWithCode.length > 0,
          imageUrl: mapped.imageUrl || null,
        };
      })
      .filter(p => p.packagesActiveCount > 0); // still hide products with zero active packages
  }

  async findOneWithPackages(tenantId: string, id: string): Promise<any> {
    const product = await this.productsRepo.findOne({
      where: { id, tenantId } as any,
      relations: ['packages', 'packages.prices', 'packages.prices.priceGroup'],
    });
    if (!product) throw new NotFoundException('لم يتم العثور على المنتج');

    const allPriceGroups = await this.priceGroupsRepo.find({
      where: { tenantId } as any,
    });
    const mapped = this.mapEffectiveImage(product as any);
    return {
      ...product,
      ...mapped,
      packages: (product.packages || []).map((pkg) => ({
        ...pkg,
        basePrice: pkg.basePrice ?? pkg.capital ?? 0,
        prices: allPriceGroups.map((group) => {
          const existingPrice = (pkg.prices || []).find(
            (price) => price.priceGroup?.id === group.id,
          );
          return {
            id: existingPrice?.id ?? null,
            groupId: group.id,
            groupName: group.name,
            price: existingPrice?.price ?? 0,
          };
        }),
      })),
    };
  }

  // ===== ✅ منتجات وباقات مرئية للمتجر فقط (publicCode != NULL) =====
  async getTenantVisibleProducts(tenantId: string): Promise<any[]> {
    const qb = this.productsRepo.createQueryBuilder('prod')
      .leftJoinAndSelect('prod.packages', 'pkg')
      .leftJoinAndSelect('pkg.prices', 'pp')
      .leftJoinAndSelect('pp.priceGroup', 'pg')
      .where('prod.tenantId = :tenantId', { tenantId })
  .andWhere('prod.isActive = TRUE')
      .andWhere('pkg.publicCode IS NOT NULL')
      .andWhere('pkg.isActive = TRUE');

    const products = await qb.getMany();
    const allPriceGroups = await this.priceGroupsRepo.find({ where: { tenantId } as any });

    return products.map((product: any) => {
      // أعد استخدام المنطق نفسه لإضافة الصورة الفعالة والأسعار بطريقة موحدة
      const mapped = this.mapEffectiveImage(product);
      return {
        ...product,
        ...mapped,
        packages: (product.packages || []).filter((pkg: any) => pkg.publicCode != null && pkg.isActive).map((pkg: any) => ({
          ...pkg,
          basePrice: pkg.basePrice ?? pkg.capital ?? 0,
          prices: allPriceGroups.map((group) => {
            const existingPrice = (pkg.prices || []).find(
              (price: any) => price.priceGroup?.id === group.id,
            );
            return {
              id: existingPrice?.id ?? null,
              groupId: group.id,
              groupName: group.name,
              price: existingPrice?.price ?? 0,
            };
          }),
        })),
      };
    });
  }

  async getTenantVisibleProductById(tenantId: string, productId: string): Promise<any> {
    // لا تشترط وجود باقات نشطة لاعتبار المنتج موجودًا
    const qb = this.productsRepo.createQueryBuilder('prod')
      .leftJoinAndSelect('prod.packages', 'pkg')
      .leftJoinAndSelect('pkg.prices', 'pp')
      .leftJoinAndSelect('pp.priceGroup', 'pg')
      .where('prod.tenantId = :tenantId', { tenantId })
      .andWhere('prod.id = :productId', { productId });

    const product: any = await qb.getOne();
    if (!product) throw new NotFoundException('لم يتم العثور على المنتج');

    const allPriceGroups = await this.priceGroupsRepo.find({ where: { tenantId } as any });
    const mapped = this.mapEffectiveImage(product);
    return {
      ...product,
      ...mapped,
      packages: (product.packages || []).filter((pkg: any) => pkg.publicCode != null && pkg.isActive).map((pkg: any) => ({
        ...pkg,
        basePrice: pkg.basePrice ?? pkg.capital ?? 0,
        prices: allPriceGroups.map((group) => {
          const existingPrice = (pkg.prices || []).find(
            (price: any) => price.priceGroup?.id === group.id,
          );
          return {
            id: existingPrice?.id ?? null,
            groupId: group.id,
            groupName: group.name,
            price: existingPrice?.price ?? 0,
          };
        }),
      })),
    };
  }

  // ===== ✅ الجسور المتاحة لمنتج (أكواد publicCode من المنتج العالمي المصدر غير الموجودة محلياً) =====
  async getAvailableBridges(tenantId: string, productId: string): Promise<number[]> {
    const product = await this.productsRepo.findOne({ where: { id: productId, tenantId } as any });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    // محاولة استدلال المنتج العالمي للمستنسخات القديمة التي لا تحمل مرجعاً
    if (!(product as any).sourceGlobalProductId) {
      try {
        // 1) جمع أكواد الباقات المحلية (نشطة أو لا) للمقارنة
        const localPkgs = await this.packagesRepo.find({ where: { product: { id: productId } } as any });
        const localCodes = new Set<number>(localPkgs.filter(p => p.publicCode != null).map(p => p.publicCode as number));
        if (localCodes.size > 0) {
          // 2) محاولة مطابقة بالاسم أولاً
          const sameNameGlobals = await this.productsRepo.find({ where: { tenantId: this.DEV_TENANT_ID, name: product.name } as any, relations: ['packages'] });
          let inferred: any = null;
          if (sameNameGlobals.length === 1) {
            const overlap = (sameNameGlobals[0].packages || []).some((gp: any) => gp.publicCode != null && localCodes.has(gp.publicCode));
            if (overlap) inferred = sameNameGlobals[0];
          }
          // 3) إن لم ينجح بالاسم، ابحث عن منتج عالمي يشارك ≥2 أكواد أو (1 كود إذا لم يوجد أكثر)
          if (!inferred) {
            const allGlobals = await this.productsRepo.find({ where: { tenantId: this.DEV_TENANT_ID } as any, relations: ['packages'] });
            let best: any = null; let bestOverlap = 0;
            for (const g of allGlobals) {
              const overlapCount = (g.packages || []).reduce((acc: number, gp: any) => acc + (gp.publicCode != null && localCodes.has(gp.publicCode) ? 1 : 0), 0);
              if (overlapCount > bestOverlap) { bestOverlap = overlapCount; best = g; }
            }
            if (best && (bestOverlap >= 2 || (bestOverlap === 1 && localCodes.size === 1))) {
              inferred = best;
            }
          }
          if (inferred) {
            (product as any).sourceGlobalProductId = inferred.id;
            try { await this.productsRepo.update(product.id, { sourceGlobalProductId: inferred.id } as any); } catch { /* ignore persist error */ }
          }
        }
      } catch (e) {
        // تجاهل أخطاء الاستدلال ولا تُفشل الطلب الأساسي
      }
    }
    if (!(product as any).sourceGlobalProductId) return [];
    const globalId = (product as any).sourceGlobalProductId as string;
    // جلب الباقات العالمية المصدر
    const global = await this.productsRepo.findOne({ where: { id: globalId, tenantId: this.DEV_TENANT_ID } as any, relations: ['packages'] });
    if (!global) return [];
    const globalCodes = new Set<number>(
      (global.packages || [])
        .filter((p: any) => p.isActive && p.publicCode != null)
        .map((p: any) => p.publicCode as number)
    );
    // جلب الباقات المحلية (نشطة أو معطلة) لإخفاء الأكواد المستخدمة
    const localPkgs = await this.packagesRepo.find({ where: { product: { id: productId } } as any });
    for (const lp of localPkgs) {
      if (lp.publicCode != null) globalCodes.delete(lp.publicCode as any);
    }
    return Array.from(globalCodes).sort((a,b)=>a-b);
  }

  async create(product: Product): Promise<Product> {
    try {
  // تأكد من وجود قيم افتراضية لكل الحقول لتجنّب أي قيود مستقبلية
  if (!product.name) product.name = 'منتج جديد';
  if (product.isActive === undefined) product.isActive = true;
  // إذا أنشأ المطوّر منتجًا جديدًا (ليس نسخة من مصدر آخر) عيّنه كمصدر
  // حافظ على nulls الاختيارية كما هي
      const saved = await this.productsRepo.save(product);
      console.log('[PRODUCTS][SERVICE] created product id=', saved.id, 'tenantId=', saved.tenantId);
      return saved;
    } catch (e) {
      console.error('[PRODUCTS][SERVICE][ERROR] create failed:', e);
      throw e;
    }
  }

  async update(
    tenantId: string,
    id: string,
    body: Partial<Product>,
  ): Promise<Product> {
    const product = await this.productsRepo.findOne({
      where: { id, tenantId } as any,
    });
    if (!product) throw new NotFoundException('لم يتم العثور على المنتج');
    Object.assign(product, body);
    return this.productsRepo.save(product);
  }

  async delete(opts: { tenantId?: string | null; role?: string | null; allowGlobal?: boolean }, id: string): Promise<void> {
    const { tenantId, role, allowGlobal } = opts || {};
    const roleLower = (role || '').toLowerCase();
    const isDev = roleLower === 'developer' || roleLower === 'instance_owner';

    if (!tenantId) {
      if (!(isDev && allowGlobal)) {
        throw new ForbiddenException('لا يوجد سياق مستأجر صالح للحذف');
      }
    }

    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    else if (isDev && allowGlobal) where.tenantId = this.DEV_TENANT_ID;

    const product = await this.productsRepo.findOne({ where });
    if (!product) throw new NotFoundException('لم يتم العثور على المنتج');

    // حواجز حماية إضافية: منع مطور من حذف منتج تينانت آخر لو مر tenantId خاطئ
    if (product.tenantId !== (where.tenantId)) {
      throw new ForbiddenException('عدم تطابق سياق المنتج مع التينانت');
    }

    // إن كان حذف عالمي تأكد من أنه فعلاً عالمي
    if (allowGlobal && isDev && product.tenantId !== this.DEV_TENANT_ID) {
      throw new ForbiddenException('هذا المنتج ليس ضمن الحاوية العالمية');
    }

    console.log('[PRODUCTS][DELETE][REQ]', { id: product.id, tenantId: product.tenantId, byRole: roleLower, allowGlobal });
    await this.productsRepo.remove(product);
    console.log('[PRODUCTS][DELETE][DONE]', { id: product.id, global: product.tenantId === this.DEV_TENANT_ID });
  }

  async createPriceGroup(
    tenantId: string,
    data: Partial<PriceGroup>,
  ): Promise<PriceGroup> {
    if (!data.name || !data.name.trim())
      throw new ConflictException('اسم المجموعة مطلوب');
    const name = data.name.trim();

    const exists = await this.priceGroupsRepo.findOne({
      where: { name, tenantId } as any,
    });
    if (exists) throw new ConflictException('هذه المجموعة موجودة مسبقًا');

    const created: PriceGroup = this.priceGroupsRepo.create({
      ...data,
      name,
      tenantId,
    } as Partial<PriceGroup>);
    const saved: PriceGroup = await this.priceGroupsRepo.save(created);
    return saved;
  }

  async deletePriceGroup(tenantId: string, id: string): Promise<void> {
    const row = await this.priceGroupsRepo.findOne({
      where: { id, tenantId } as any,
    });
    if (!row) throw new NotFoundException('لم يتم العثور على المجموعة');
    await this.priceGroupsRepo.remove(row);
  }

  async getUsersPriceGroups(
    tenantId: string,
  ): Promise<{ id: string; name: string; usersCount: number }[]> {
    const rows = await this.priceGroupsRepo
      .createQueryBuilder('pg')
      .leftJoin('users', 'u', 'u."priceGroupId" = pg.id AND u."tenantId" = :tenantId')
      .select('pg.id', 'id')
      .addSelect('pg.name', 'name')
      .addSelect('COUNT(u.id)', 'usersCount')
      .where('pg."tenantId" = :tenantId')
      .setParameter('tenantId', tenantId)
      .groupBy('pg.id, pg.name')
      .getRawMany();
    return rows.map(r => ({ id: r.id, name: r.name, usersCount: Number.parseInt(r.usersCount, 10) || 0 }));
  }

  // 🔹 مجموعات الأسعار

  async getPriceGroups(tenantId: string): Promise<PriceGroup[]> {
    return this.priceGroupsRepo.find({ where: { tenantId } as any });
  }

  async addPackageToProduct(
    tenantId: string,
    productId: string,
    data: Partial<ProductPackage>,
    ctx?: { userId?: string; finalRole?: string },
  ): Promise<ProductPackage> {
    // Lightweight debug log
    try {
      console.log('[PKG][CREATE][START]', {
        tenantId: tenantId?.slice(0, 8),
        productId: productId?.slice(0, 8),
        name: data?.name,
        publicCode: (data as any)?.publicCode,
        by: ctx?.finalRole || 'unknown',
      });
    } catch {}
    if (!data.name || !data.name.trim()) throw new ConflictException('اسم الباقة مطلوب');

    let product = await this.productsRepo.findOne({
      where: { id: productId, tenantId } as any,
      relations: ['packages'],
    });
    if (!product) {
      // محاولة بديلة: إن كان المستخدم مطوّرًا، اسمح له بالوصول لمنتج "مصدر" حتى لو لم يطابق tenantId
      const alt = await this.productsRepo.findOne({ where: { id: productId } as any, relations: ['packages'] });
      // المنتج يجب أن يكون ضمن نفس المستأجر الآن بعد إزالة منطق المصدر/الاستنساخ
      console.warn('[PKG][CREATE][NF] product not found for tenant', {
        productId: productId?.slice(0,8), tenantId: tenantId?.slice(0,8), role: ctx?.finalRole,
      });
      throw new NotFoundException('المنتج غير موجود في هذا المستأجر');
    }

  // Catalog linking removed: no catalogLinkCode validation required.

  // catalogLinking feature removed: no validation

    const initialCapital = Number(data.capital ?? data.basePrice ?? 0);

    const newPackage: ProductPackage = this.packagesRepo.create({
      tenantId,
      name: data.name.trim(),
      description: data.description ?? '',
      basePrice: initialCapital,
      capital: initialCapital,
      isActive: data.isActive ?? true,
      imageUrl: data.imageUrl,
      product,
      createdByDistributorId: (data as any).createdByDistributorId || null,
      providerName: (data as any).providerName || null,
    } as Partial<ProductPackage>);

    // اختيارياً: ضبط publicCode أثناء الإنشاء إن وُفّر
    if (data.publicCode != null) {
      const pc = Number(data.publicCode);
      if (Number.isInteger(pc) && pc > 0) {
        // تحقق أنه غير مستخدم داخل نفس المنتج فقط
        const existing = await this.packagesRepo.findOne({ where: { product: { id: product.id }, publicCode: pc } as any, relations: ['product'] });
        if (existing) {
          console.warn('[PKG][CREATE][ERR] publicCode already used in product', { publicCode: pc, productId: product.id });
          const err: any = new ConflictException('الكود مستخدم داخل نفس المنتج');
          (err as any).code = 'PKG_PUBLIC_CODE_CONFLICT';
          throw err;
        }
  // لم يعد هناك كتالوج: نسمح بالكود إذا غير مكرر فقط
  if (product) console.log('[PKG][CREATE][INFO] assigning publicCode', { pc, productId: product.id });
        (newPackage as any).publicCode = pc;
      } else if (data.publicCode !== null) {
        console.warn('[PKG][CREATE][ERR] invalid publicCode value', { value: data.publicCode });
  const err: any = new BadRequestException('publicCode غير صالح (يجب أن يكون رقمًا موجبًا)');
  err.code = 'PKG_PUBLIC_CODE_INVALID';
  throw err;
      }
    }

    // ✅ ثبّت النوع هنا
    const saved: ProductPackage = await this.packagesRepo.save(newPackage);

    // أنشئ مصفوفة الـ rows أولاً ثم create(array) مرة واحدة
    const priceGroups = await this.priceGroupsRepo.find({
      where: { tenantId } as any,
    });
    const rowsData = priceGroups.map((group) => ({
      tenantId,
      package: saved,
      priceGroup: group,
      price: initialCapital,
    })) as Partial<PackagePrice>[];

    const prices: PackagePrice[] = this.packagePriceRepo.create(rowsData);
    await this.packagePriceRepo.save(prices);

    (saved as any).prices = prices;
    try {
      console.log('[PKG][CREATE][OK]', {
        id: saved.id?.slice(0, 8),
        publicCode: (saved as any).publicCode,
        capital: saved.capital,
      });
    } catch {}
    return saved as ProductPackage;
  }

  // deletePackage + updatePackageProvider already defined later (deduplicated above)

  /** ✅ تحديث رأس المال وأسعار الباقة لكل مجموعة */
  async updatePackagePrices(
    tenantId: string,
    packageId: string,
    data: { capital: number; prices: { groupId: string; price: number }[] },
  ) {
    const pkg = await this.packagesRepo.findOne({
      where: { id: packageId, tenantId } as any,
      relations: ['prices', 'prices.priceGroup'],
    });
    if (!pkg) throw new NotFoundException('لم يتم العثور على الباقة');

    pkg.capital = Number(data.capital || 0);
    pkg.basePrice = Number(data.capital || 0);
    await this.packagesRepo.save(pkg);

    for (const p of data.prices || []) {
      const group = await this.priceGroupsRepo.findOne({
        where: { id: p.groupId, tenantId } as any,
      });
      if (!group) continue;

      let priceEntity = (pkg.prices || []).find(
        (pr) => pr.priceGroup?.id === p.groupId,
      );

      if (!priceEntity) {
        const createdPrice: PackagePrice = this.packagePriceRepo.create({
          tenantId,
          package: pkg,
          priceGroup: group,
          price: Number(p.price || 0),
        } as Partial<PackagePrice>);
        priceEntity = createdPrice;
      } else {
        priceEntity.price = Number(p.price || 0);
      }

      await this.packagePriceRepo.save(priceEntity);
    }

    return { message: 'تم تحديث أسعار الباقة ورأس المال بنجاح' };
  }

  /** ✅ جلب أسعار باقات متعددة */
  async getPackagesPricesBulk(
    tenantId: string,
    body: { packageIds: string[]; groupId?: string },
  ) {
    if (!Array.isArray(body.packageIds) || body.packageIds.length === 0) {
      throw new BadRequestException('packageIds مطلوب');
    }
    const ids = body.packageIds.slice(0, 1000);

    const rows = await this.packagePriceRepo.find({
      where: body.groupId
        ? ({
            tenantId,
            package: { id: In(ids) },
            priceGroup: { id: body.groupId },
          } as any)
        : ({ tenantId, package: { id: In(ids) } } as any),
      relations: ['package', 'priceGroup'],
    });

    return rows.map((p) => ({
      packageId: p.package.id,
      groupId: p.priceGroup.id,
      groupName: p.priceGroup.name,
      priceId: p.id,
      price: Number(p.price) || 0,
    }));
  }

  // ================== التسعير الأساس (بالدولار) ==================
  private async getEffectivePriceUSD(packageId: string, userId: string): Promise<number> {
    const [pkg, user] = await Promise.all([
      this.packagesRepo.findOne({
        where: { id: packageId } as any,
        relations: ['prices', 'prices.priceGroup'],
      }),
      this.usersRepo.findOne({
        where: { id: userId } as any,
        relations: ['priceGroup'],
      }),
    ]);

    if (!pkg) throw new NotFoundException('الباقة غير موجودة');
    if (!user) throw new NotFoundException('المستخدم غير موجود');

    // 🔒 تأكد من تطابق المستأجر بين المستخدم والباقة
    this.ensureSameTenant((pkg as any).tenantId, (user as any).tenantId);

    const base = Number(pkg.basePrice ?? pkg.capital ?? 0);
    if (!user?.priceGroup) return base;

    const match = (pkg.prices ?? []).find(
      (p) => p.priceGroup?.id === user.priceGroup!.id,
    );
    return match ? Number(match.price) : base;
  }

  /** تحويل mappedStatus القادم من الدرايفر إلى حالة خارجية داخلية موحّدة */
  private mapMappedToExternalStatus(mapped?: string) {
    const s = String(mapped || '').toLowerCase();
    if (['success', 'ok', 'done', 'completed', 'complete'].includes(s))
      return 'done';
    if (
      ['failed', 'fail', 'error', 'rejected', 'cancelled', 'canceled'].includes(
        s,
      )
    )
      return 'failed';
    if (['sent', 'accepted', 'queued', 'queue'].includes(s)) return 'sent';
    return 'processing';
  }

  /** محاولة إرسال الطلب تلقائيًا حسب إعدادات التوجيه (مع تجربة fallback مرة واحدة إن لزم) */
  private async tryAutoDispatch(orderId: string, tenantId?: string) {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId } as any,
      relations: ['package', 'product', 'user'],
    });
    if (!order) return;

    this.ensureSameTenant((order as any).user?.tenantId, tenantId);

    // ✅ tenantId الفعّال لهذا التنفيذ
    const effectiveTenantId = String(
      tenantId ?? (order as any)?.user?.tenantId,
    );
    // إن أردت التشديد:
    // if (!effectiveTenantId) throw new BadRequestException('tenantId is required');

    if (order.providerId || order.externalOrderId || order.status !== 'pending')
      return;

    return;

  }

  async createOrder(
    data: {
      productId: string;
      packageId: string;
      quantity: number;
      userId: string;
      userIdentifier?: string;
      extraField?: string;
    },
    tenantId?: string,
  ) {
    const {
      productId,
      packageId,
      quantity,
      userId,
      userIdentifier,
      extraField,
    } = data;

    if (!quantity || quantity <= 0 || !Number.isFinite(Number(quantity))) {
      throw new BadRequestException('Quantity must be a positive number');
    }

    const created = await this.ordersRepo.manager.transaction(async (trx) => {
      const productsRepo = trx.getRepository(Product);
      const packagesRepo = trx.getRepository(ProductPackage);
      const usersRepo = trx.getRepository(User);
      const ordersRepo = trx.getRepository(ProductOrder);
      const packagePriceRepo = trx.getRepository(PackagePrice);
      const distPkgPriceRepo = trx.getRepository(DistributorPackagePrice);
      const distUserGroupRepo = trx.getRepository(DistributorUserPriceGroup);

      // جلب المستخدم + العملة
      const user = await usersRepo.findOne({
        where: { id: userId } as any,
        relations: ['currency', 'priceGroup'],
      });
      if (!user) throw new NotFoundException('المستخدم غير موجود');

      // 🔐 تأكيد أن الطلب ينتمي لنفس المستأجر المتوقع (إن تم تمريره)
      this.ensureSameTenant((user as any).tenantId, tenantId);

      if (user.isActive === false) {
        throw new ConflictException('الحساب غير فعّال');
      }

      // جلب المنتج والباقة وتحقق المستأجر
      const [product, pkg] = await Promise.all([
        productsRepo.findOne({ where: { id: productId } as any }),
        packagesRepo.findOne({ where: { id: packageId } as any }),
      ]);
      if (!product) throw new NotFoundException('المنتج غير موجود');
      if (!pkg) throw new NotFoundException('الباقة غير موجودة');

      // ✅ تأكد أن المنتج والباقة بنفس مستأجر المستخدم
      this.ensureSameTenant((product as any).tenantId, (user as any).tenantId);
      this.ensureSameTenant((pkg as any).tenantId, (user as any).tenantId);

      // التسعير بالدولار (الدالة تتحقق من المستأجر داخليًا)
      const unitPriceUSD = await this.getEffectivePriceUSD(packageId, userId);
      const totalUSD = Number(unitPriceUSD) * Number(quantity);

      const rate = user.currency ? Number(user.currency.rate) : 1;
      const code = user.currency ? user.currency.code : 'USD';
      const totalUser = totalUSD * rate;

      // خصم الرصيد + تحقق حد السالب
      const balance = Number(user.balance) || 0;
      const overdraft = Number(user.overdraftLimit) || 0;
      if (totalUser > balance + overdraft) {
        throw new ConflictException(
          'الرصيد غير كافٍ (تجاوز حد السالب المسموح)',
        );
      }
      user.balance = balance - totalUser;
      await usersRepo.save(user);

      // إنشاء الطلب
      const order = ordersRepo.create({
        product,
        package: pkg,
        quantity,
        price: totalUSD,
        status: 'pending',
        user,
        userIdentifier: userIdentifier ?? null,
        extraField: extraField ?? null,
      });

  // 🔒 لقطة USD وقت الإنشاء (price هو إجمالي البيع بالدولار بالفعل)
  (order as any).sellUsdAtOrder = totalUSD;
  const baseCostPerUnit = Number((pkg as any).basePrice ?? (pkg as any).capital ?? 0) || 0;
  const costUsdSnapshot = baseCostPerUnit * Number(quantity);
  (order as any).costUsdAtOrder = costUsdSnapshot;
  (order as any).profitUsdAtOrder = Number((totalUSD - costUsdSnapshot).toFixed(4));

      // Phase2/3: تحديد الموزّع الجذر (سواء المستخدم نفسه موزّع أو مستخدم فرعي له parentUserId)
      let rootDistributor: any = null;
      const userAny: any = user as any;
      if (isFeatureEnabled('catalogLinking')) {
        if (
          userAny.roleFinal === 'distributor' ||
          userAny.role === 'distributor'
        ) {
          rootDistributor = userAny;
        } else if (userAny.parentUserId) {
          // اجلب المستخدم الأب
          rootDistributor = await usersRepo.findOne({
            where: { id: userAny.parentUserId } as any,
            relations: ['priceGroup'],
          });
          if (!rootDistributor)
            throw new BadRequestException('الموزّع الأب غير موجود');
          if (
            !(
              rootDistributor.roleFinal === 'distributor' ||
              rootDistributor.role === 'distributor'
            )
          ) {
            throw new BadRequestException('المستخدم الأب ليس موزّعًا');
          }
        }
        if (rootDistributor) {
          (order as any).placedByDistributorId = rootDistributor.id;
        }
      }

      // 🧷 تضمين tenantId صراحةً على الكيان
      (order as any).tenantId = (user as any).tenantId;

      const saved = await ordersRepo.save<ProductOrder>(order);

      // Phase3: منطق اللقطات المتقدم
      if (isFeatureEnabled('catalogLinking') && rootDistributor) {
        try {
          // A) capitalUSD: سعر رأس مال الموزّع حسب مجموعة أسعار المتجر الخاصة به
          let capitalPerUnitUSD = 0;
          if (rootDistributor.priceGroup?.id) {
            const priceRow = await packagePriceRepo.findOne({
              where: {
                package: { id: packageId } as any,
                priceGroup: { id: rootDistributor.priceGroup.id } as any,
              } as any,
              relations: ['priceGroup', 'package'],
            });
            if (priceRow) {
              capitalPerUnitUSD = Number(priceRow.price) || 0;
            } else {
              capitalPerUnitUSD =
                Number(pkg.basePrice ?? pkg.capital ?? 0) || 0;
            }
          } else {
            capitalPerUnitUSD = Number(pkg.basePrice ?? pkg.capital ?? 0) || 0;
          }

          // B) sellUSD: سعر بيع الموزّع للمستخدم الفرعي
          let sellPerUnitUSD: number;
          const isSubUser = user.id !== rootDistributor.id; // مستخدم فرعي
          if (isSubUser) {
            // استرجاع مجموعة المستخدم الفرعي من distributor_user_price_groups
            const userGroup = await distUserGroupRepo.findOne({
              where: { userId: user.id } as any,
            });
            if (!userGroup) {
              throw new UnprocessableEntityException(
                'Distributor price not configured',
              );
            }
            const pkgPrice = await distPkgPriceRepo.findOne({
              where: {
                distributorUserId: rootDistributor.id,
                distributorPriceGroupId: userGroup.distributorPriceGroupId,
                packageId,
              } as any,
            });
            if (!pkgPrice) {
              throw new UnprocessableEntityException(
                'Distributor price not configured',
              );
            }
            sellPerUnitUSD = Number(pkgPrice.priceUSD) || 0;
          } else {
            // الموزّع نفسه — استخدم التسعير الفعّال الحالي (unitPriceUSD)
            sellPerUnitUSD = Number(unitPriceUSD) || 0;
          }

          // C) ضرب في الكمية
          const qty = Number(quantity);
          const capitalTotalUSD = capitalPerUnitUSD * qty;
          const sellTotalUSD = sellPerUnitUSD * qty;

          // D) snapshots
          const profitUSD = sellTotalUSD - capitalTotalUSD;
          // FX snapshot لعملة الموزع
          let distCurr: string | undefined =
            rootDistributor.preferredCurrencyCode ||
            userAny.preferredCurrencyCode ||
            'USD';
          if (!distCurr) distCurr = 'USD';
          let fxUsdToDist = 1;
          if (distCurr !== 'USD') {
            const curRow = await this.currenciesRepo.findOne({
              where: {
                tenantId: (user as any).tenantId,
                code: distCurr,
              } as any,
            });
            if (curRow?.rate && Number(curRow.rate) > 0)
              fxUsdToDist = Number(curRow.rate);
          }
          await ordersRepo.update(saved.id, {
            distributorCapitalUsdAtOrder: capitalTotalUSD.toFixed(6),
            distributorSellUsdAtOrder: sellTotalUSD.toFixed(6),
            distributorProfitUsdAtOrder: profitUSD.toFixed(6),
            fxUsdToDistAtOrder: fxUsdToDist.toFixed(6),
            distCurrencyCodeAtOrder: distCurr,
          } as any);
          (saved as any).distributorCapitalUsdAtOrder =
            capitalTotalUSD.toFixed(6);
          (saved as any).distributorSellUsdAtOrder = sellTotalUSD.toFixed(6);
          (saved as any).distributorProfitUsdAtOrder = profitUSD.toFixed(6);
          (saved as any).fxUsdToDistAtOrder = fxUsdToDist.toFixed(6);
          (saved as any).distCurrencyCodeAtOrder = distCurr;
        } catch (e) {
          if (e instanceof UnprocessableEntityException) {
            throw e; // أعد تمريرها لـ 422
          }
          // لا تفشل الطلب لأخطاء غير متوقعة — فقط سجل
          console.error('[Distributor Snapshot Error]', e);
        }
      }

      // عرض مختصر
      type OrderView = {
        id: string;
        status: 'pending' | 'approved' | 'rejected';
        quantity: number;
        priceUSD: number;
        unitPriceUSD: number;
        display: {
          currencyCode: string;
          unitPrice: number;
          totalPrice: number;
        };
        product: { id: string; name: string | null };
        package: { id: string; name: string | null };
        userIdentifier: string | null;
        extraField: string | null;
        createdAt: Date;
      };

      return {
        entityId: saved.id,
        view: {
          id: saved.id,
          status: saved.status,
          quantity: saved.quantity,
          priceUSD: totalUSD,
          unitPriceUSD,
          display: {
            currencyCode: code,
            unitPrice: unitPriceUSD * rate,
            totalPrice: totalUser,
          },
          product: { id: product.id, name: product.name ?? null },
          package: { id: pkg.id, name: pkg.name ?? null },
          userIdentifier: saved.userIdentifier ?? null,
          extraField: saved.extraField ?? null,
          createdAt: saved.createdAt,
        } satisfies OrderView,
      };
    });

    // محاولة إرسال تلقائي ضمن نفس المستأجر
    try {
      await this.tryAutoDispatch(created.entityId, tenantId);
    } catch {}

    return created.view;
  }

  // === Orders & Listing ===
  async getAllOrders(status?: OrderStatus, tenantId?: string) {
    // ✅ اجلب أسعار العملات ضمن نفس التينانت (لو مُمرَّر)، وإلا fallback للكل
    const currencies = await (tenantId
      ? this.currenciesRepo.find({ where: { tenantId } as any })
      : this.currenciesRepo.find());

    const getRate = (code: string) => {
      const row = currencies.find(
        (c) => c.code.toUpperCase() === code.toUpperCase(),
      );
      return row ? Number(row.rate) : undefined;
    };
    const TRY_RATE = getRate('TRY') ?? 1;

    const toTRY = (amount: number, code?: string, tenantId?: string) => {
      const c = (code || 'TRY').toUpperCase();
      if (c === 'TRY') return amount;
      const r = getRate(c);
      if (!r || !Number.isFinite(r) || r <= 0) return amount;
      return amount * (TRY_RATE / r);
    };

    const pickImage = (obj: any): string | null => {
      if (!obj) return null;
      return (
        obj.imageUrl ??
        obj.image ??
        obj.logoUrl ??
        obj.iconUrl ??
        obj.icon ??
        null
      );
    };

    // (نبقيها كما هي لتجنّب كسر التواقيع؛ خدمة integrations.list قد تكون تُراعي التينانت أصلاً)
    const integrations = await this.integrations.list(String(tenantId));
    const providersMap = new Map<string, string>();
    for (const it of integrations as any[])
      providersMap.set(it.id, it.provider);

    const query = this.ordersRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('user.currency', 'currency')
      .leftJoinAndSelect('order.product', 'product')
      .leftJoinAndSelect('order.package', 'package')
      .orderBy('order.createdAt', 'DESC');

    if (status) query.where('order.status = :status', { status });
    this.addTenantWhere(query, 'user', tenantId); // ✅ نقيّد حسب tenant عبر المستخدم

    const orders = await query.getMany();

    const approvedIds = orders
      .filter((o) => o.status === 'approved')
      .map((o) => o.id);
    let frozenMap = new Map<
      string,
      {
        fxLocked: boolean;
        sellTryAtApproval: number | null;
        costTryAtApproval: number | null;
        profitTryAtApproval: number | null;
        approvedLocalDate: string | null;
      }
    >();

    if (approvedIds.length) {
      const rows = await this.ordersRepo.query(
        `SELECT id,
                COALESCE("fxLocked", false)           AS "fxLocked",
                "sellTryAtApproval",
                "costTryAtApproval",
                "profitTryAtApproval",
                "approvedLocalDate"
          FROM "product_orders"
          WHERE id = ANY($1::uuid[])`,
        [approvedIds],
      );
      frozenMap = new Map(
        rows.map((r: any) => [
          String(r.id),
          {
            fxLocked: !!r.fxLocked,
            sellTryAtApproval:
              r.sellTryAtApproval != null ? Number(r.sellTryAtApproval) : null,
            costTryAtApproval:
              r.costTryAtApproval != null ? Number(r.costTryAtApproval) : null,
            profitTryAtApproval:
              r.profitTryAtApproval != null
                ? Number(r.profitTryAtApproval)
                : null,
            approvedLocalDate: r.approvedLocalDate
              ? String(r.approvedLocalDate)
              : null,
          },
        ]),
      );
    }

    return orders.map((order) => {
      const priceUSD = Number(order.price) || 0;
      const unitPriceUSD = order.quantity
        ? priceUSD / Number(order.quantity)
        : priceUSD;

      const providerType = order.providerId
        ? providersMap.get(order.providerId)
        : undefined;
      const isExternal = !!(order.providerId && order.externalOrderId);

      const frozen = frozenMap.get(order.id);
      const isFrozen = !!(
        frozen &&
        frozen.fxLocked &&
        order.status === 'approved'
      );

      let sellTRY: number;
      let costTRY: number;
      let profitTRY: number;

      if (isFrozen) {
        sellTRY = Number(frozen.sellTryAtApproval ?? 0);
        costTRY = Number(frozen.costTryAtApproval ?? 0);
        const profitFrozenRaw =
          frozen.profitTryAtApproval != null
            ? Number(frozen.profitTryAtApproval)
            : sellTRY - costTRY;
        sellTRY = Number(sellTRY.toFixed(2));
        costTRY = Number(costTRY.toFixed(2));
        profitTRY = Number(profitFrozenRaw.toFixed(2));
      } else {
        if (isExternal) {
          const amt = Math.abs(Number(order.costAmount ?? 0));
          let cur = String(order.costCurrency || '')
            .toUpperCase()
            .trim();
          if (providerType === 'znet') cur = 'TRY';
          if (!cur) cur = 'USD';
          costTRY = toTRY(amt, cur);
        } else {
          const baseUSD = Number(
            (order as any).package?.basePrice ??
              (order as any).package?.capital ??
              0,
          );
          const qty = Number(order.quantity ?? 1);
          costTRY = baseUSD * qty * TRY_RATE;
        }

        sellTRY = priceUSD * TRY_RATE;
        profitTRY = sellTRY - costTRY;

        sellTRY = Number(sellTRY.toFixed(2));
        costTRY = Number(costTRY.toFixed(2));
        profitTRY = Number(profitTRY.toFixed(2));
      }

      const userRate = order.user?.currency
        ? Number(order.user.currency.rate)
        : 1;
      const userCode = order.user?.currency ? order.user.currency.code : 'USD';
      const totalUser = priceUSD * userRate;
      const unitUser = unitPriceUSD * userRate;

      const sellUsdSnap = (order as any).sellUsdAtOrder != null ? Number((order as any).sellUsdAtOrder) : priceUSD;
      const costUsdSnap = (order as any).costUsdAtOrder != null ? Number((order as any).costUsdAtOrder) : null;
      const profitUsdSnap = (order as any).profitUsdAtOrder != null
        ? Number((order as any).profitUsdAtOrder)
        : (costUsdSnap != null ? Number((sellUsdSnap - costUsdSnap).toFixed(4)) : null);

      return {
        id: order.id,
        orderNo: (order as any).orderNo ?? null,
        username: (order.user as any)?.username ?? null,
        status: order.status,
        externalStatus: (order as any).externalStatus,
        externalOrderId: order.externalOrderId ?? null,
        providerId: order.providerId ?? null,

        quantity: order.quantity,

  price: totalUser,
  currencyCode: userCode,
  unitPrice: unitUser,
  priceUSD: sellUsdSnap,
  unitPriceUSD: order.quantity ? sellUsdSnap / Number(order.quantity) : sellUsdSnap,
        display: {
          currencyCode: userCode,
          unitPrice: unitUser,
          totalPrice: totalUser,
        },

        currencyTRY: 'TRY',
        sellTRY,
        costTRY,
        profitTRY,

  sellUsdAtOrder: sellUsdSnap,
  costUsdAtOrder: costUsdSnap,
  profitUsdAtOrder: profitUsdSnap,
  costAmount: order.costAmount ?? null,
        costCurrency: order.costCurrency ?? null,

        fxLocked: isFrozen,
        approvedLocalDate: frozen?.approvedLocalDate ?? null,

        sentAt: order.sentAt ? order.sentAt.toISOString() : null,
        lastSyncAt: (order as any).lastSyncAt
          ? (order as any).lastSyncAt.toISOString()
          : null,
        completedAt: order.completedAt ? order.completedAt.toISOString() : null,

        createdAt: order.createdAt.toISOString(),
        userEmail: order.user?.email || 'غير معروف',
        extraField: (order as any).extraField ?? null,

        product: {
          id: order.product?.id,
          name: order.product?.name,
          imageUrl: pickImage((order as any).product),
        },
        package: {
          id: order.package?.id,
          name: order.package?.name,
          imageUrl: pickImage((order as any).package),
        },

        providerMessage:
          (order as any).providerMessage ?? (order as any).lastMessage ?? null,
        pinCode: (order as any).pinCode ?? null,
        notesCount: Array.isArray((order as any).notes)
          ? (order as any).notes.length
          : 0,
        manualNote: (order as any).manualNote ?? null,
        lastMessage: (order as any).lastMessage ?? null,
      };
    });
  }

  // ------------------
  async getUserOrders(userId: string, tenantId?: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId } as any,
      relations: ['currency'],
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    if (tenantId) this.ensureSameTenant((user as any).tenantId, tenantId);

    const rate = user.currency ? Number(user.currency.rate) : 1;
    const code = user.currency ? user.currency.code : 'USD';

    const orders = await this.ordersRepo.find({
      where: { user: { id: userId } as any },
      relations: ['product', 'package'],
      order: { createdAt: 'DESC' as any },
    });

    const pickImage = (obj: any): string | null =>
      obj
        ? (obj.imageUrl ??
          obj.image ??
          obj.logoUrl ??
          obj.iconUrl ??
          obj.icon ??
          null)
        : null;

    return orders.map((order) => {
      const priceUSD = Number(order.price) || 0;
      const unitPriceUSD = order.quantity
        ? priceUSD / Number(order.quantity)
        : priceUSD;

      return {
        id: order.id,
        status: order.status,
        quantity: order.quantity,
        priceUSD,
        unitPriceUSD,
        display: {
          currencyCode: code,
          unitPrice: unitPriceUSD * rate,
          totalPrice: priceUSD * rate,
        },
        createdAt: order.createdAt,
        userIdentifier: order.userIdentifier ?? null,
        extraField: (order as any).extraField ?? null,

        providerMessage:
          (order as any).providerMessage ?? (order as any).lastMessage ?? null,
        pinCode: (order as any).pinCode ?? null,
        lastMessage: (order as any).lastMessage ?? null,

        product: {
          id: order.product.id,
          name: order.product.name,
          imageUrl: pickImage(order.product),
        },
        package: {
          id: order.package.id,
          name: order.package.name,
          imageUrl: pickImage(order.package),
          productId: order.product.id,
        },
      };
    });
  }

  private async freezeFxOnApprovalIfNeeded(orderId: string): Promise<void> {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId } as any,
      relations: ['user', 'user.currency', 'package'],
    });
    if (!order) return;

    const locked = (order as any).fxLocked === true;
    if (locked) return;

    // ✅ اجلب TRY الخاص بنفس التينانت (إن وُجد)
    const tenantId = (order as any).user?.tenantId as string | undefined;
    const tryRow = await this.currenciesRepo.findOne({
      where: tenantId
        ? ({ code: 'TRY', isActive: true, tenantId } as any)
        : ({ code: 'TRY', isActive: true } as any),
    });
    const fxUsdTry = tryRow?.rate ? Number(tryRow.rate) : 1;

    const priceUSD = Number(order.price || 0);
    const sellTryAtApproval = Number((priceUSD * fxUsdTry).toFixed(2));

    let costTryAtApproval = 0;
    const costAmount =
      order.costAmount != null ? Math.abs(Number(order.costAmount)) : null;
    let costCur = (order.costCurrency as any)
      ? String(order.costCurrency).toUpperCase().trim()
      : '';
    if (costAmount && costAmount > 0) {
      if (!costCur) costCur = 'USD';

      if (costCur === 'TRY') {
        costTryAtApproval = Number(costAmount.toFixed(2));
      } else if (costCur === 'USD') {
        costTryAtApproval = Number((costAmount * fxUsdTry).toFixed(2));
      } else {
        // ✅ لو عملة أخرى، نجيب سعرها من نفس التينانت إن أمكن
        const curRow = await this.currenciesRepo.findOne({
          where: tenantId
            ? ({ code: costCur, tenantId } as any)
            : ({ code: costCur } as any),
        });
        const r = curRow?.rate ? Number(curRow.rate) : undefined;
        costTryAtApproval =
          r && r > 0
            ? Number((costAmount * (fxUsdTry / r)).toFixed(2))
            : Number(costAmount.toFixed(2));
      }
    } else {
      const baseUSD = Number(
        (order as any)?.package?.basePrice ??
          (order as any)?.package?.capital ??
          0,
      );
      const qty = Number(order.quantity ?? 1);
      costTryAtApproval = Number((baseUSD * qty * fxUsdTry).toFixed(2));
    }

    const profitTryAtApproval = Number(
      (sellTryAtApproval - costTryAtApproval).toFixed(2),
    );
    const profitUsdAtApproval =
      fxUsdTry > 0 ? Number((profitTryAtApproval / fxUsdTry).toFixed(2)) : 0;

    const approvedAt = (order as any).approvedAt
      ? new Date((order as any).approvedAt)
      : new Date();

    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = fmt.formatToParts(approvedAt);
    const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
    const m = parts.find((p) => p.type === 'month')?.value ?? '01';
    const d = parts.find((p) => p.type === 'day')?.value ?? '01';
    const approvedLocalDate = `${y}-${m}-${d}`;
    const approvedLocalMonth = `${y}-${m}`;

    await this.ordersRepo.update(
      { id: order.id },
      {
        ...({ fxUsdTryAtApproval: fxUsdTry } as any),
        ...({ sellTryAtApproval } as any),
        ...({ costTryAtApproval } as any),
        ...({ profitTryAtApproval } as any),
        ...({ profitUsdAtApproval } as any),
        ...({ fxCapturedAt: new Date() } as any),
        ...({ approvedAt } as any),
        ...({ approvedLocalDate } as any),
        ...({ approvedLocalMonth } as any),
        ...({ fxLocked: true } as any),
      },
    );
  }

  // ------------------------
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    tenantId?: string,
  ) {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId } as any,
      relations: ['user', 'user.currency', 'package'],
    });
    if (!order) return null;

    // حماية: لا نعيد حساب لقطات الموزع أو FX إن كان الطلب في حالة نهائية
    // NOTE: We include a superset of possible terminal labels (approved/completed/failed/cancelled/refunded)
    // even if current InternalOrderStatus enum only uses (pending|approved|rejected) to future-proof
    // and avoid recomputation should additional terminal statuses be introduced.
    const terminalStatuses = new Set([
      'approved',
      'completed',
      'failed',
      'cancelled',
      'refunded',
    ]);
    if (
      terminalStatuses.has(String(order.status)) &&
      (order as any).distributorSellUsdAtOrder
    ) {
      // فقط السماح بتغيير حالات معينة (مثلاً approved->rejected سابقاً) حسب المنطق الأصلي، بدون أي لمس لحقول distributor*
    }

    // ✅ تعريف مرّة وحدة
    const effectiveTenantId = String(
      tenantId ?? (order as any)?.user?.tenantId,
    );

    const row = await this.ordersRepo.query(
      `SELECT "approvedLocalDate" FROM "product_orders" WHERE id = $1 LIMIT 1`,
      [orderId],
    );
    const approvedLocalDate: Date | null = row?.[0]?.approvedLocalDate
      ? new Date(row[0].approvedLocalDate)
      : null;

    if (order.status === 'approved' && status !== 'approved') {
      const approvedLocalDateStr = approvedLocalDate
        ? approvedLocalDate.toISOString().slice(0, 10)
        : undefined;

      if (approvedLocalDateStr) {
        await this.accounting.assertApprovedMonthOpen(approvedLocalDateStr);
      }
    }

    const prevStatus = order.status;
    console.log('[SERVICE updateOrderStatus] change', {
      orderId: orderId,
      prevStatus,
      nextStatus: status,
      userId: order.user?.id,
    });

    const user = order.user;

    const rate = user?.currency ? Number(user.currency.rate) : 1;
    const priceUSD = Number(order.price) || 0;
    const amountInUserCurrency = priceUSD * rate;

    let deltaUser = 0;

    if (status === 'rejected' && prevStatus !== 'rejected') {
      user.balance = Number(user.balance || 0) + amountInUserCurrency;
      await this.usersRepo.save(user);
      deltaUser = amountInUserCurrency;
    }

    if (status === 'approved' && prevStatus === 'rejected') {
      const balance = Number(user.balance) || 0;
      const overdraft = Number(user.overdraftLimit) || 0;

      if (balance - amountInUserCurrency < -overdraft) {
        throw new ConflictException(
          'الرصيد غير كافٍ لإعادة خصم الطلب (تجاوز حد السالب المسموح)',
        );
      }

      user.balance = balance - amountInUserCurrency;
      await this.usersRepo.save(user);
      deltaUser = -amountInUserCurrency;
    }

    order.status = status as InternalOrderStatus;
    const saved = await this.ordersRepo.save(order);
    console.log('[SERVICE updateOrderStatus] saved', {
      orderId: saved.id,
      status: saved.status,
    });

    if (status === 'approved') {
      try {
        await this.freezeFxOnApprovalIfNeeded(saved.id);
      } catch {}
    }
    if (prevStatus === 'approved' && status !== 'approved') {
      await this.ordersRepo.update(
        { id: order.id },
        {
          ...({ fxLocked: false } as any),
          ...({ fxUsdTryAtApproval: null } as any),
          ...({ sellTryAtApproval: null } as any),
          ...({ costTryAtApproval: null } as any),
          ...({ profitTryAtApproval: null } as any),
          ...({ profitUsdAtApproval: null } as any),
          ...({ fxCapturedAt: null } as any),
          ...({ approvedAt: null } as any),
          ...({ approvedLocalDate: null } as any),
          ...({ approvedLocalMonth: null } as any),
        },
      );
    }

    // ✅ استخدام نفس المتغيّر
    await this.notifications.orderStatusChanged(
      user.id,
      effectiveTenantId,
      saved.id,
      prevStatus as 'approved' | 'rejected' | 'pending',
      status as 'approved' | 'rejected' | 'pending',
      {
        deltaAmountUserCurrency: Number(deltaUser || 0),
        packageName: order.package?.name ?? undefined,
        userIdentifier: order.userIdentifier || undefined,
      },
    );

    return saved;
  }

  private async getUserDisplayContext(userId: string, tenantId?: string) {
    const user = await this.usersRepo.findOne({
      where: { id: userId } as any,
      relations: ['currency', 'priceGroup'],
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    // 🔐 تأكد انتماء المستخدم لنفس المستأجر (إن تم تمرير tenantId)
    this.ensureSameTenant((user as any).tenantId, tenantId);

    let rate = 1;
    let code = 'USD';
    let priceGroupId: string | null = null;

    if (user?.currency?.rate) {
      rate = Number(user.currency.rate);
      code = user.currency.code;
    }
    if (user?.priceGroup?.id) {
      priceGroupId = user.priceGroup.id;
    }
    return { rate, code, priceGroupId };
  }

  private mapProductForUser(
    product: Product,
    rate: number,
    priceGroupId: string | null,
  ) {
    const img = this.mapEffectiveImage(product as any);
    const base = {
      id: product.id,
      name: product.name,
      description: (product as any)['description'] ?? null,
  imageUrl: img.imageUrl,
  imageSource: img.imageSource,
  hasCustomImage: img.hasCustomImage,
  customImageUrl: img.customImageUrl,
  customAltText: (product as any).customAltText ?? null,
  thumbSmallUrl: (product as any).thumbSmallUrl ?? null,
  thumbMediumUrl: (product as any).thumbMediumUrl ?? null,
  thumbLargeUrl: (product as any).thumbLargeUrl ?? null,
    };

    return {
      ...base,
      packages: product.packages.map((pkg) => {
        const groupMatch = (pkg.prices ?? []).find(
          (p) =>
            p.priceGroup?.id &&
            priceGroupId &&
            p.priceGroup.id === priceGroupId,
        );

        const effectiveUSD = groupMatch
          ? Number(groupMatch.price ?? 0)
          : Number(pkg.basePrice ?? pkg.capital ?? 0);

        return {
          id: pkg.id,
          name: pkg.name,
          description: pkg.description ?? null,
          imageUrl: pkg.imageUrl ?? null,
          isActive: pkg.isActive,
          basePrice: Number(effectiveUSD) * rate,
          prices: (pkg.prices ?? []).map((p) => ({
            id: p.id,
            groupId: p.priceGroup.id,
            groupName: p.priceGroup.name,
            price: Number(p.price ?? 0) * rate,
          })),
        };
      }),
    };
  }

  async findAllForUser(tenantId: string, userId: string) {
    const { rate, code, priceGroupId } = await this.getUserDisplayContext(
      userId,
      tenantId,
    );

    const products = await this.productsRepo.find({
      where: { tenantId } as any,
      relations: ['packages', 'packages.prices', 'packages.prices.priceGroup'],
      order: { name: 'ASC' },
    });

    return {
      currencyCode: code,
      items: products.map((p) => this.mapProductForUser(p, rate, priceGroupId)),
    };
  }

  async findOneForUser(tenantId: string, productId: string, userId: string) {
    const { rate, code, priceGroupId } = await this.getUserDisplayContext(
      userId,
      tenantId,
    );

    const product = await this.productsRepo.findOne({
      where: { id: productId, tenantId } as any,
      relations: ['packages', 'packages.prices', 'packages.prices.priceGroup'],
    });
    if (!product) throw new NotFoundException('لم يتم العثور على المنتج');

    return {
      currencyCode: code,
      ...this.mapProductForUser(product, rate, priceGroupId),
    };
  }

  /**
   * Compute effective image for product (catalog removed): just returns customImageUrl if present.
   */
  private mapEffectiveImage(product: any) {
    const customImageUrl = product.customImageUrl ?? null;
  const effective = customImageUrl || null;
  const source: 'custom' | null = customImageUrl ? 'custom' : null;
  return { imageUrl: effective, imageSource: source, hasCustomImage: !!customImageUrl, customImageUrl };
  }

  async listOrdersWithPagination(dto: ListOrdersDto, tenantId?: string) {
    const limit = Math.max(1, Math.min(100, dto.limit ?? 25));
    const cursor = decodeCursor(dto.cursor);

    const qb = this.ordersRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'u')
      .leftJoinAndSelect('u.currency', 'uc')
      .leftJoinAndSelect('o.package', 'pkg')
      .leftJoinAndSelect('o.product', 'prod');

    const userIdFilter = (dto as any)?.userId as string | undefined;
    if (userIdFilter) {
      qb.andWhere('u.id = :uid', { uid: userIdFilter });
    }

    if (dto.status) qb.andWhere('o.status = :status', { status: dto.status });
    if (dto.method === 'manual') {
      qb.andWhere('(o.providerId IS NULL OR o.externalOrderId IS NULL)');
    } else if (dto.method) {
      qb.andWhere('o.providerId = :pid AND o.externalOrderId IS NOT NULL', {
        pid: dto.method,
      });
    }
    if (dto.from)
      qb.andWhere('o.createdAt >= :from', {
        from: new Date(dto.from + 'T00:00:00Z'),
      });
    if (dto.to)
      qb.andWhere('o.createdAt <= :to', {
        to: new Date(dto.to + 'T23:59:59Z'),
      });

    const _q = (dto.q ?? '').trim();
    if (_q) {
      if (/^\d+$/.test(_q)) {
        const qd = _q;
        qb.andWhere(
          new Brackets((b) => {
            b.where('CAST(o.orderNo AS TEXT) = :qd', { qd })
              .orWhere('o.userIdentifier = :qd', { qd })
              .orWhere('o.externalOrderId = :qd', { qd });
          }),
        );
      } else {
        const q = `%${_q.toLowerCase()}%`;
        qb.andWhere(
          new Brackets((b) => {
            b.where('LOWER(prod.name) LIKE :q', { q })
              .orWhere('LOWER(pkg.name) LIKE :q', { q })
              .orWhere('LOWER(u.username) LIKE :q', { q })
              .orWhere('LOWER(u.email) LIKE :q', { q })
              .orWhere('LOWER(o.userIdentifier) LIKE :q', { q })
              .orWhere('LOWER(o.externalOrderId) LIKE :q', { q });
          }),
        );
      }
    }

    // 🔐 تقييد المستأجر
    this.addTenantWhere(qb, 'u', tenantId);

    if (cursor) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('o.createdAt < :cts', { cts: new Date(cursor.ts) }).orWhere(
            new Brackets((bb) => {
              bb.where('o.createdAt = :cts', {
                cts: new Date(cursor.ts),
              }).andWhere('o.id < :cid', { cid: cursor.id });
            }),
          );
        }),
      );
    }

    qb.orderBy('o.createdAt', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .take(limit + 1);

    const rows = await qb.getMany();
    const hasMore = rows.length > limit;
    const pageItems = hasMore ? rows.slice(0, limit) : rows;

    // ====== حسابات TRY مثل getAllOrders (✅ بحدود التينانت) ======
    const currencies = await (tenantId
      ? this.currenciesRepo.find({ where: { tenantId } as any })
      : this.currenciesRepo.find());
    const getRate = (code: string) => {
      const row = currencies.find(
        (c) => c.code.toUpperCase() === code.toUpperCase(),
      );
      return row ? Number(row.rate) : undefined;
    };
    const TRY_RATE = getRate('TRY') ?? 1;
    const toTRY = (amount: number, code?: string) => {
      const c = (code || 'TRY').toUpperCase();
      const r = getRate(c);
      return r && r > 0 ? amount * (TRY_RATE / r) : amount;
    };

    const integrations = await this.integrations.list(tenantId ?? '');
    const providerKind = new Map<string, string>();
    for (const it of integrations as any[])
      providerKind.set(it.id, it.provider);

    const pickImage = (obj: any): string | null =>
      obj
        ? (obj.imageUrl ??
          obj.image ??
          obj.logoUrl ??
          obj.iconUrl ??
          obj.icon ??
          null)
        : null;

    const approvedIds = pageItems
      .filter((o) => o.status === 'approved')
      .map((o) => o.id);
    let frozenMap = new Map<
      string,
      {
        fxLocked: boolean;
        sellTryAtApproval: number | null;
        costTryAtApproval: number | null;
        profitTryAtApproval: number | null;
        approvedLocalDate: string | null;
      }
    >();

    if (approvedIds.length) {
      const rowsFx = await this.ordersRepo.query(
        `SELECT id,
                COALESCE("fxLocked", false)           AS "fxLocked",
                "sellTryAtApproval",
                "costTryAtApproval",
                "profitTryAtApproval",
                "approvedLocalDate"
        FROM "product_orders"
        WHERE id = ANY($1::uuid[])`,
        [approvedIds],
      );
      frozenMap = new Map(
        rowsFx.map((r: any) => [
          String(r.id),
          {
            fxLocked: !!r.fxLocked,
            sellTryAtApproval:
              r.sellTryAtApproval != null ? Number(r.sellTryAtApproval) : null,
            costTryAtApproval:
              r.costTryAtApproval != null ? Number(r.costTryAtApproval) : null,
            profitTryAtApproval:
              r.profitTryAtApproval != null
                ? Number(r.profitTryAtApproval)
                : null,
            approvedLocalDate: r.approvedLocalDate
              ? String(r.approvedLocalDate)
              : null,
          },
        ]),
      );
    }

    const items = pageItems.map((o) => {
      const priceUSD = Number(o.price || 0);
      const unitPriceUSD = o.quantity
        ? priceUSD / Number(o.quantity)
        : priceUSD;

      const providerType = o.providerId
        ? providerKind.get(o.providerId)
        : undefined;
      const isExternal = !!(o.providerId && o.externalOrderId);

      const frozen = frozenMap.get(o.id);
      const isFrozen = !!(frozen && frozen.fxLocked && o.status === 'approved');

      let sellTRY: number;
      let costTRY: number;
      let profitTRY: number;

      if (isFrozen) {
        sellTRY = Number((frozen.sellTryAtApproval ?? 0).toFixed(2));
        costTRY = Number((frozen.costTryAtApproval ?? 0).toFixed(2));
        const p =
          frozen.profitTryAtApproval != null
            ? Number(frozen.profitTryAtApproval)
            : sellTRY - costTRY;
        profitTRY = Number(p.toFixed(2));
      } else {
        if (isExternal) {
          const amt = Math.abs(Number(o.costAmount ?? 0));
          let cur = String(o.costCurrency || '')
            .toUpperCase()
            .trim();
          if (providerType === 'znet') cur = 'TRY';
          if (!cur) cur = 'USD';
          costTRY = toTRY(amt, cur);
        } else {
          const baseUSD = Number(
            (o as any).package?.basePrice ?? (o as any).package?.capital ?? 0,
          );
          const qty = Number(o.quantity ?? 1);
          costTRY = baseUSD * qty * TRY_RATE;
        }

        sellTRY = priceUSD * TRY_RATE;
        profitTRY = sellTRY - costTRY;

        sellTRY = Number(sellTRY.toFixed(2));
        costTRY = Number(costTRY.toFixed(2));
        profitTRY = Number(profitTRY.toFixed(2));
      }

      const userRate = o.user?.currency ? Number(o.user.currency.rate) : 1;
      const userCode = o.user?.currency ? o.user.currency.code : 'USD';

      return {
        id: o.id,
        orderNo: (o as any).orderNo ?? null,
        username: (o.user as any)?.username ?? null,
        userEmail: (o.user as any)?.email ?? null,

        product: {
          id: o.product?.id,
          name: o.product?.name,
          imageUrl: pickImage(o.product),
        },
        package: {
          id: o.package?.id,
          name: o.package?.name,
          imageUrl: pickImage(o.package),
        },

        status: o.status,
        providerId: o.providerId ?? null,
        externalOrderId: o.externalOrderId ?? null,
        userIdentifier: o.userIdentifier ?? null,
        extraField: (o as any).extraField ?? null,

        quantity: o.quantity,
        priceUSD,
        sellTRY,
        costTRY,
        profitTRY,
        currencyTRY: 'TRY',

        sellPriceAmount: priceUSD * userRate,
        sellPriceCurrency: userCode,

        fxLocked: isFrozen,
        approvedLocalDate: frozen?.approvedLocalDate ?? null,

        sentAt: o.sentAt ? o.sentAt.toISOString() : null,
        completedAt: o.completedAt ? o.completedAt.toISOString() : null,
        durationMs: (o as any).durationMs ?? null,
        createdAt: o.createdAt.toISOString(),

        providerMessage:
          (o as any).providerMessage ?? (o as any).lastMessage ?? null,
        pinCode: (o as any).pinCode ?? null,
        notesCount: Array.isArray((o as any).notes)
          ? (o as any).notes.length
          : 0,
        manualNote: (o as any).manualNote ?? null,
        lastMessage: (o as any).lastMessage ?? null,
      };
    });

    const last = items[items.length - 1] || null;
    const nextCursor = last
      ? encodeCursor(toEpochMs(new Date(last.createdAt)), String(last.id))
      : null;

    return {
      items,
      pageInfo: { nextCursor, hasMore },
      meta: {
        limit,
        appliedFilters: {
          q: dto.q || '',
          status: dto.status || '',
          method: dto.method || '',
          from: dto.from || '',
          to: dto.to || '',
        },
      },
    };
  }

  // ✅ إضافة/قراءة ملاحظات الطلب
  async addOrderNote(
    orderId: string,
    by: 'admin' | 'system' | 'user',
    text: string,
    tenantId?: string,
  ) {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId } as any,
      relations: ['user'],
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    this.ensureSameTenant((order as any).user?.tenantId, tenantId);

    const now = new Date().toISOString();
    const note = { by, text: String(text || '').slice(0, 500), at: now };

    const current: any[] = Array.isArray((order as any).notes)
      ? (order as any).notes
      : [];
    (order as any).notes = [...current, note];
    (order as any).notesCount = (order as any).notes.length;

    await this.ordersRepo.save(order);
    return (order as any).notes;
  }

  async getOrderDetailsForUser(
    orderId: string,
    userId: string,
    tenantId?: string,
  ) {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId, user: { id: userId } as any } as any,
      relations: ['product', 'package', 'user', 'user.currency'],
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');

    // 🔐 تأكيد انتماء الطلب لنفس المستأجر
    this.ensureSameTenant((order as any).user?.tenantId, tenantId);

    const priceUSD = Number(order.price) || 0;
    const rate = order.user?.currency ? Number(order.user.currency.rate) : 1;
    const code = order.user?.currency ? order.user.currency.code : 'USD';

    return {
      id: order.id,
      status: order.status,
      quantity: order.quantity,
      createdAt: order.createdAt,
      userIdentifier: order.userIdentifier ?? null,
      extraField: (order as any).extraField ?? null,

      priceUSD,
      unitPriceUSD: order.quantity
        ? priceUSD / Number(order.quantity)
        : priceUSD,
      display: {
        currencyCode: code,
        unitPrice:
          (order.quantity ? priceUSD / Number(order.quantity) : priceUSD) *
          rate,
        totalPrice: priceUSD * rate,
      },

      product: {
        id: order.product?.id,
        name: order.product?.name,
        imageUrl: (order as any).product?.imageUrl ?? null,
      },
      package: {
        id: order.package?.id,
        name: order.package?.name,
        imageUrl: (order as any).package?.imageUrl ?? null,
      },

      manualNote: (order as any).manualNote ?? null,
      providerMessage:
        (order as any).providerMessage ?? (order as any).lastMessage ?? null,
      notes: Array.isArray((order as any).notes) ? (order as any).notes : [],
    };
  }

  // ===== ✅ تحديث publicCode لباقـة (فريد عالميًا) =====
  async updatePackageCode(id: string, code: number | null | undefined) {
    const pkg = await this.packagesRepo.findOne({ where: { id } as any });
    if (!pkg) throw new NotFoundException('الباقة غير موجودة');

    if (code == null) {
      await this.packagesRepo.update({ id }, { publicCode: null });
      return { ok: true, id, publicCode: null };
    }

    const trimmed = Number(code);
    if (!Number.isInteger(trimmed) || trimmed < 1) {
      throw new BadRequestException('publicCode يجب أن يكون رقمًا صحيحًا موجبًا');
    }

    let finalCode = trimmed;
    const conflict = await this.packagesRepo.findOne({ where: { publicCode: finalCode } as any });
    if (conflict && conflict.id !== id) {
      const alt = finalCode + 1;
      const altConflict = await this.packagesRepo.findOne({ where: { publicCode: alt } as any });
      if (!altConflict) {
        finalCode = alt;
      } else {
        throw new ConflictException('الكود مستخدم بالفعل (Conflict)');
      }
    }

    await this.packagesRepo.update({ id }, { publicCode: finalCode });
    return { ok: true, id, publicCode: finalCode };
  }

  // ===== ✅ تعديل أساسي لحقول الباقة (الاسم، الوصف، basePrice، isActive) =====
  async updatePackageBasic(
    tenantId: string | undefined,
    packageId: string,
    data: { name?: string; description?: string | null; basePrice?: number; isActive?: boolean },
  ) {
    const pkg = await this.packagesRepo.findOne({ where: { id: packageId } as any });
    if (!pkg) throw new NotFoundException('الباقة غير موجودة');
    if (tenantId && pkg.tenantId && pkg.tenantId !== tenantId) {
      throw new BadRequestException('لا تملك صلاحية تعديل هذه الباقة');
    }
    const patch: any = {};
    if (data.name !== undefined) patch.name = String(data.name).trim() || pkg.name;
    if (data.description !== undefined)
      patch.description = data.description == null ? null : String(data.description).trim();
    if (data.basePrice !== undefined && data.basePrice != null && Number.isFinite(Number(data.basePrice))) {
      patch.basePrice = Number(data.basePrice);
    }
    if (data.isActive !== undefined) patch.isActive = !!data.isActive;
    if (Object.keys(patch).length === 0) return { ok: true, id: pkg.id };
    await this.packagesRepo.update({ id: packageId }, patch);
    const updated = await this.packagesRepo.findOne({ where: { id: packageId } as any });
    return { ok: true, id: packageId, package: updated };
  }
}
