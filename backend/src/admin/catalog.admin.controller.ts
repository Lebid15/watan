// src/admin/catalog.admin.controller.ts
import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query,
  UseGuards, NotFoundException, BadRequestException, Req,
  UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import type { Request } from 'express';

import { CatalogProduct } from '../catalog/catalog-product.entity';
import { Asset } from '../assets/asset.entity';
import { AuditService } from '../audit/audit.service';
import { CatalogPackage } from '../catalog/catalog-package.entity';

// متجر المشرف (Tenant-scoped)
import { Product } from '../products/product.entity';
import { ProductPackage } from '../products/product-package.entity';

// العملات (Tenant-scoped)
import { Currency } from '../currencies/currency.entity';
import { WebhooksService } from '../webhooks/webhooks.service';

function normalizePkgName(input: any): string {
  const raw = (input ?? '').toString();
  const noTags = raw.replace(/<[^>]*>/g, ' ');
  const oneSpace = noTags.replace(/\s+/g, ' ').trim();
  const MAX = 100;
  const out = oneSpace.length > MAX ? oneSpace.slice(0, MAX) : oneSpace;
  return out || 'Package';
}

@Controller('admin/catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DEVELOPER, UserRole.ADMIN)
export class CatalogAdminController {
  constructor(
    @InjectRepository(CatalogProduct)  private readonly productsRepo:   Repository<CatalogProduct>,
    @InjectRepository(CatalogPackage)  private readonly packagesRepo:   Repository<CatalogPackage>,
    @InjectRepository(Product)         private readonly shopProducts:   Repository<Product>,
    @InjectRepository(ProductPackage)  private readonly shopPackages:   Repository<ProductPackage>,
  @InjectRepository(Currency)        private readonly currencyRepo:   Repository<Currency>,
  private readonly webhooks: WebhooksService,
  @InjectRepository(Asset) private readonly assetRepo: Repository<Asset>,
  private readonly auditService: AuditService,
  ) {}

  /* =======================
     قائمة منتجات الكتالوج (عالمي)
     ======================= */
  @Get('products')
  async listProducts(
    @Query('q') q?: string,
    @Query('withCounts') withCounts?: string,
  ) {
    if (withCounts === '1') {
      const qb = this.productsRepo
        .createQueryBuilder('p')
        .leftJoin(CatalogPackage, 'pkg', 'pkg.catalogProductId = p.id')
        .select([
          'p.id AS id',
          'p.name AS name',
          'p.description AS description',
          'p.imageUrl AS "imageUrl"',
          'p.sourceProviderId AS "sourceProviderId"',
          'p.externalProductId AS "externalProductId"',
          'p.isActive AS "isActive"',
          'COUNT(pkg.id)::int AS "packagesCount"',
        ])
        .groupBy('p.id')
        .orderBy('p.name', 'ASC')
        .limit(500);

      if (q?.trim()) qb.where('p.name ILIKE :q', { q: `%${q.trim()}%` });

      const rows = await qb.getRawMany();
      return { items: rows };
    }

    const where = q ? { name: ILike(`%${q}%`) } : {};
    const items = await this.productsRepo.find({
      where,
      order: { name: 'ASC' },
      take: 500,
    });
    return { items };
  }

  /* =======================
     منتج كتالوج واحد بحسب المعرّف
     ======================= */
  @Get('products/:id')
  async getCatalogProduct(@Param('id') id: string) {
    const p = await this.productsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Catalog product not found');
    return { item: p };
  }

  /* =======================
     باقات منتج كتالوج (عالمي)
     ======================= */
  @Get('products/:id/packages')
  async listPackages(@Param('id') productId: string) {
    try {
      const items = await this.packagesRepo.find({
        where: { catalogProductId: productId },
        order: { name: 'ASC' },
        take: 1000,
      });
      return { items };
    } catch (err) {
      // سجل الخطأ وأعد قائمة فارغة ورسالة واضحة
      console.error('[listPackages] error:', err);
      return { items: [], error: 'فشل جلب الباقات: تحقق من المنتج أو الربط.' };
    }
  }

  /* ===========================================
     1) تفعيل كل باقات "كتالوج منتج" في متجر المشرف (Tenant)
     =========================================== */
  @Post('products/:id/enable-all')
  async enableAllForCatalogProduct(@Param('id') catalogProductId: string, @Req() req: Request) {
    const tenantId = (req as any)?.user?.tenantId as string | undefined;
    if (!tenantId) throw new BadRequestException('Missing tenantId');

    const catalogProduct = await this.productsRepo.findOne({ where: { id: catalogProductId } });
    if (!catalogProduct) throw new NotFoundException('Catalog product not found');

    // منتج المتجر بنفس الاسم داخل نفس المستأجر
    let shopProduct = await this.shopProducts.findOne({ where: { tenantId, name: catalogProduct.name } });
    if (!shopProduct) {
      shopProduct = await this.shopProducts.save(
        this.shopProducts.create({
          tenantId,
          name:        catalogProduct.name,
          description: (catalogProduct as any).description ?? null,
          imageUrl:    (catalogProduct as any).imageUrl ?? null,
          isActive:    true,
        } as Partial<Product>)
      );
    }
    // لو متجر بلا صورة وكتالوج عنده صورة → انسخها
    if (!(shopProduct as any).catalogImageUrl && (catalogProduct as any).imageUrl) {
      (shopProduct as any).catalogImageUrl = (catalogProduct as any).imageUrl; // copy into catalog reference field
      await this.shopProducts.save(shopProduct);
    }

    // باقات الكتالوج
    const cpkgs = await this.packagesRepo.find({
      where: { catalogProductId: catalogProduct.id },
      order: { name: 'ASC' },
      take: 5000,
    });

    // باقات المتجر الحالية — فهرس بالأسماء المُنقّاة
    const existingShopPkgs = await this.shopPackages.find({
      where: { tenantId, product: { id: shopProduct.id } },
    });
    const byName = new Map(existingShopPkgs.map((p) => [normalizePkgName(p.name), p]));

    let created = 0;
    let skipped = 0;

    for (const c of cpkgs) {
      const cleanName = normalizePkgName((c as any).name);
      if (byName.has(cleanName)) { skipped++; continue; }

      // publicCode فريدة داخل نفس الـ tenant فقط
      let publicCode: string | null = (c as any).publicCode ?? null;
      if (publicCode) {
        const conflict = await this.shopPackages.findOne({ where: { tenantId, publicCode } });
        if (conflict) publicCode = null;
      }

      const pkg = this.shopPackages.create({
        tenantId,
        product:   shopProduct,
        name:      cleanName,
        publicCode,
        basePrice: 0,
        capital:   0,
        isActive:  true,
      } as Partial<ProductPackage>);
      await this.shopPackages.save(pkg);
      created++;
    }

    return {
      ok: true,
      productId: shopProduct.id,
      createdPackages: created,
      skippedPackages: skipped,
      totalFromCatalog: cpkgs.length,
    };
  }

  /* ===========================================
     2) تفعيل كل منتجات/باقات مزوّد في المتجر (Tenant)
     =========================================== */
  @Post('providers/:providerId/enable-all')
  async enableAllForProvider(@Param('providerId') providerId: string, @Req() req: Request) {
    const tenantId = (req as any)?.user?.tenantId as string | undefined;
    if (!tenantId) throw new BadRequestException('Missing tenantId');

    const catalogProducts = await this.productsRepo.find({
      where: { sourceProviderId: providerId },
      order: { name: 'ASC' },
      take: 5000,
    });

    let productsTouched = 0;
    let totalCreated = 0;
    let totalSkipped = 0;
    let totalCatalogPkgs = 0;

    for (const cp of catalogProducts) {
      // منتج المتجر بنفس الاسم ضمن نفس الـ tenant
      let sp = await this.shopProducts.findOne({ where: { tenantId, name: cp.name } });
      if (!sp) {
        sp = await this.shopProducts.save(
          this.shopProducts.create({
            tenantId,
            name:        cp.name,
            description: (cp as any).description ?? null,
            imageUrl:    (cp as any).imageUrl ?? null,
            isActive:    true,
          } as Partial<Product>)
        );
      }
      if (!(sp as any).catalogImageUrl && (cp as any).imageUrl) {
        (sp as any).catalogImageUrl = (cp as any).imageUrl;
        await this.shopProducts.save(sp);
      }
      productsTouched++;

      // باقات الكتالوج لهذا المنتج
      const cpkgs = await this.packagesRepo.find({
        where: { catalogProductId: cp.id },
        order: { name: 'ASC' },
        take: 5000,
      });
      totalCatalogPkgs += cpkgs.length;

      // باقات المتجر الحالية — فهرس بالأسماء المُنقّاة
      const existingShopPkgs = await this.shopPackages.find({
        where: { tenantId, product: { id: sp.id } },
      });
      const byName = new Map(existingShopPkgs.map((p) => [normalizePkgName(p.name), p]));

      for (const c of cpkgs) {
        const cleanName = normalizePkgName((c as any).name);
        if (byName.has(cleanName)) { totalSkipped++; continue; }

        let publicCode: string | null = (c as any).publicCode ?? null;
        if (publicCode) {
          const conflict = await this.shopPackages.findOne({ where: { tenantId, publicCode } });
          if (conflict) publicCode = null;
        }

        const pkg = this.shopPackages.create({
          tenantId,
          product:   sp,
          name:      cleanName,
          publicCode,
          basePrice: 0,
          capital:   0,
          isActive:  true,
        } as Partial<ProductPackage>);
        await this.shopPackages.save(pkg);
        totalCreated++;
      }
    }

    return {
      ok: true,
      providerId,
      productsTouched,
      createdPackages: totalCreated,
      skippedPackages: totalSkipped,
      totalCatalogPackages: totalCatalogPkgs,
    };
  }

  /* ===========================================
     3) تحديث صورة منتج كتالوج (مع نشر للصنف في المتجر/tenant)
     =========================================== */
  @Put('products/:id/image')
  @UseInterceptors(FileInterceptor('file', {
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = /^image\/(png|jpe?g|webp|gif|bmp|svg\+xml)$/i.test(file.mimetype);
      if (!ok) return cb(new Error('Only image files are allowed'), false);
      cb(null, true);
    },
  }))
  async setCatalogProductImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: { imageUrl?: string; propagate?: boolean },
    @Req() req: Request,
  ) {
    // إذا وصل ملف نرفع أولاً (يعتمد على تكامل خارجي: Cloudinary عبر upload controller)
    if (file) {
      // استدعاء مباشر لنفس مسار الرفع الحالي غير متاح هنا بدون تكرار الشيفرة؛ لأجل البساطة نرفض إن لم يوجد imageUrl.
      // (بديل مستقبلي: إنشاء خدمة رفع مشتركة.)
      throw new BadRequestException('Use /admin/upload first to get image URL then send PATCH with imageUrl');
    }
    // tenantId يكون مطلوب فقط إذا أردنا النشر (propagate) إلى متجر محدد
    const tenantId = (req as any)?.tenant?.id || (req as any)?.user?.tenantId as string | undefined;
    if (!tenantId && body?.propagate) {
      // أوضح الرسالة للمطور/الواجهة: يمكن إزالة propagate أو تمرير X-Tenant-Id
      throw new BadRequestException('Missing tenantId: cannot propagate image to tenant store. Provide X-Tenant-Id header or remove propagate flag.');
    }
    // eslint-disable-next-line no-console
    console.log('[Catalog][ImageUpdate]', { id, hasTenant: !!tenantId, propagate: !!body?.propagate });

    const p = await this.productsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Catalog product not found');

  const previousUrl = (p as any).imageUrl ?? null;
  (p as any).imageUrl = body?.imageUrl ?? null;
  await this.productsRepo.save(p);

  if (body?.propagate && tenantId) {
      const sp = await this.shopProducts.findOne({ where: { tenantId, name: p.name } });
      if (sp && !(sp as any).catalogImageUrl && (p as any).imageUrl) {
        (sp as any).catalogImageUrl = (p as any).imageUrl;
        await this.shopProducts.save(sp);
      }
    }

    // If changed, emit webhook + internal audit-style log via webhook
    if (previousUrl !== (p as any).imageUrl) {
      const url = process.env.WEBHOOK_CATALOG_IMAGE_CHANGED_URL;
      if (url) {
        this.webhooks.postJson(url, {
          event: 'catalog.product.image.changed',
          catalogProductId: id,
          newImageUrl: (p as any).imageUrl ?? null,
          previousImageUrl: previousUrl,
          propagated: !!body?.propagate,
          tenantId: tenantId || null,
          at: new Date().toISOString(),
        }).catch(() => {});
      }
    }
    return { ok: true, id, imageUrl: (p as any).imageUrl ?? null, changed: previousUrl !== (p as any).imageUrl };
  }

  /* ===========================================
     تعديل رابط صورة منتج كتالوج (PATCH نفس المسار)
     =========================================== */
  @Patch('products/:id/image')
  async patchCatalogProductImage(
    @Param('id') id: string,
    @Body() body: { imageUrl?: string; propagate?: boolean },
    @Req() req: Request,
  ) {
    const tenantId = (req as any)?.tenant?.id || (req as any)?.user?.tenantId as string | undefined;
    if (!tenantId && body?.propagate) {
      throw new BadRequestException('Missing tenantId: cannot propagate image to tenant store. Provide X-Tenant-Id header or remove propagate flag.');
    }
    const p = await this.productsRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Catalog product not found');
    const previousUrl = (p as any).imageUrl ?? null;
    (p as any).imageUrl = body?.imageUrl ?? null;
    await this.productsRepo.save(p);
    if (body?.propagate && tenantId) {
      const sp = await this.shopProducts.findOne({ where: { tenantId, name: p.name } });
      if (sp && !(sp as any).catalogImageUrl && (p as any).imageUrl) {
        (sp as any).catalogImageUrl = (p as any).imageUrl;
        await this.shopProducts.save(sp);
      }
    }
    if (previousUrl !== (p as any).imageUrl) {
      const url = process.env.WEBHOOK_CATALOG_IMAGE_CHANGED_URL;
      if (url) {
        this.webhooks.postJson(url, {
          event: 'catalog.product.image.changed',
          catalogProductId: id,
          newImageUrl: (p as any).imageUrl ?? null,
          previousImageUrl: previousUrl,
          propagated: !!body?.propagate,
          tenantId: tenantId || null,
          at: new Date().toISOString(),
        }).catch(() => {});
      }
    }
    return { ok: true, id, imageUrl: (p as any).imageUrl ?? null, changed: previousUrl !== (p as any).imageUrl };
  }

  /* ===========================================
     3b) رفع وربط صورة المنتج مباشرة (upload + assign)
     =========================================== */
  @Post('products/:id/image/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const ok = /^image\/(png|jpe?g|webp|gif|bmp|svg\+xml)$/i.test(file.mimetype);
      if (!ok) return cb(new Error('Only image files are allowed'), false);
      cb(null, true);
    },
  }))
  async directUploadProductImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: any,
    @Body('propagate') propagate?: boolean,
  ) {
    if (!file) throw new BadRequestException('No file');
    const user = req?.user || {};
    const tenantId: string | null = user.tenantId ?? null;
    if (propagate && !tenantId) {
      throw new BadRequestException('Missing tenantId for propagation');
    }
    const product = await this.productsRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Catalog product not found');
    const cloud = require('cloudinary').v2;
    const folder = tenantId ? `watan/tenants/${tenantId}/products` : 'watan/global/products';
    const started = Date.now();
    const result = await new Promise<any>((resolve, reject) => {
      const stream = cloud.uploader.upload_stream({ folder, resource_type: 'image', overwrite: false, unique_filename: true }, (err, res) => {
        if (err) return reject(err);
        if (!res) return reject(new Error('Empty Cloudinary response'));
        resolve(res);
      });
      stream.on('error', reject);
      stream.end(file.buffer);
    });
    const previousUrl = (product as any).imageUrl ?? null;
    (product as any).imageUrl = result.secure_url;
    await this.productsRepo.save(product);
    if (propagate && tenantId) {
      const sp = await this.shopProducts.findOne({ where: { tenantId, name: product.name } });
      if (sp && !(sp as any).catalogImageUrl) {
        (sp as any).catalogImageUrl = result.secure_url;
        await this.shopProducts.save(sp);
      }
    }
    try {
      const asset = this.assetRepo.create({
        tenantId,
        uploaderUserId: user.id || null,
        role: user.role,
        purpose: 'products',
        productId: id,
        originalName: file.originalname,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes,
        width: result.width || null,
        height: result.height || null,
        secureUrl: result.secure_url,
        folder: result.folder || folder,
      });
      await this.assetRepo.save(asset);
      try { await this.auditService.log('catalog_product_image_upload', { actorUserId: user.id, targetTenantId: tenantId, meta: { productId: id, previousUrl, elapsedMs: Date.now() - started } }); } catch {}
    } catch (e) { console.error('[Catalog][ImageUpload][WARN] persist asset', e); }
    return { ok: true, id, imageUrl: (product as any).imageUrl, previousUrl, changed: previousUrl !== (product as any).imageUrl };
  }

  /* ===========================================
     3c) قائمة الأصول مع فلاتر بسيطة
     =========================================== */
  @Get('assets')
  async listAssets(
    @Query('purpose') purpose?: string,
    @Query('tenantId') tenantIdFilter?: string,
    @Query('productId') productId?: string,
    @Query('limit') limitRaw?: string,
    @Query('offset') offsetRaw?: string,
    @Req() req?: any,
  ) {
    const user = req?.user || {};
    const role = user.role;
    const tenantIdUser: string | null = user.tenantId ?? null;
    const qb = this.assetRepo.createQueryBuilder('a').orderBy('a.createdAt', 'DESC');
    const limit = Math.min(parseInt(limitRaw || '30', 10), 100);
    const offset = parseInt(offsetRaw || '0', 10);
    if (purpose) qb.andWhere('a.purpose = :purpose', { purpose });
    if (productId) qb.andWhere('a.productId = :pid', { pid: productId });
    if (role !== 'developer') {
      qb.andWhere('a.tenantId = :tid', { tid: tenantIdUser });
    } else if (tenantIdFilter) {
      qb.andWhere('a.tenantId = :tidFilter', { tidFilter: tenantIdFilter });
    }
    qb.take(limit).skip(offset);
    const [rows, total] = await qb.getManyAndCount();
    return { ok: true, total, count: rows.length, items: rows };
  }

  /* ===========================================
     حذف أصل (مع تحقق الصلاحيات) + محاولة حذف Cloudinary
     =========================================== */
  @Delete('assets/:id')
  async deleteAsset(@Param('id') id: string, @Req() req: any) {
    const user = req?.user || {};
    const role = user.role;
    const tenantIdUser: string | null = user.tenantId ?? null;
    const asset = await this.assetRepo.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Asset not found');
    if (role !== 'developer') {
      if (asset.tenantId == null || asset.tenantId !== tenantIdUser) {
        throw new BadRequestException('Not allowed to delete this asset');
      }
    }
    let cloudinaryResult: string | null = null;
    try {
      if (asset.publicId) {
        const cloud = require('cloudinary').v2;
        try {
          const res = await cloud.uploader.destroy(asset.publicId);
          cloudinaryResult = (res && res.result) || 'ok';
        } catch (e:any) {
          cloudinaryResult = 'error';
        }
      } else {
        cloudinaryResult = 'not_found';
      }
    } catch { cloudinaryResult = cloudinaryResult || 'error'; }
    await this.assetRepo.delete(asset.id);
    try { await this.auditService.log('asset_delete', { actorUserId: user.id, targetTenantId: asset.tenantId, meta: { assetId: id, publicId: asset.publicId, cloudinaryResult } }); } catch {}
    return { success: true, id, cloudinary: { result: cloudinaryResult } };
  }

  /* ===========================================
     4) تحديث الأسعار من الكتالوج → متجر المشرف (USD) (Tenant)
     =========================================== */
  @Post('providers/:providerId/refresh-prices')
  async refreshPricesForProvider(
    @Param('providerId') providerId: string,
    @Body() body: { mode?: 'copy' | 'markup'; markupPercent?: number; fixedFee?: number; overwriteZero?: boolean } | undefined,
    @Req() req: Request,
  ) {
    const tenantId = (req as any)?.user?.tenantId as string | undefined;
    if (!tenantId) throw new BadRequestException('Missing tenantId');

    const mode = (body?.mode === 'markup') ? 'markup' : 'copy';
    const markupPercent = Number(body?.markupPercent ?? 0) || 0;
    const fixedFee = Number(body?.fixedFee ?? 0) || 0;
    const overwriteZero = body?.overwriteZero !== false; // افتراضي: true

    // منتجات الكتالوج لهذا المزود (عالمي)
    const catalogProducts = await this.productsRepo.find({
      where: { sourceProviderId: providerId },
      order: { name: 'ASC' },
      take: 10000,
    });

    // أسعار صرف خاصة بالـ tenant
    const currencies = await this.currencyRepo.find({ where: { tenantId } as any });
    const unitToUsd: Record<string, number> = {};
    for (const c of currencies as any[]) {
      const code = (c.code ?? c.currency ?? '').toString().toUpperCase();
      if (!code) continue;

      const toUsd =
        Number(c.rateToUsd ?? c.usdRate ?? c.toUsd ?? 0) || 0;

      const perUsd =
        Number(c.perUsd ?? c.rateFromUsd ?? c.rate ?? 0) || 0;

      let k = 0;
      if (toUsd > 0) k = toUsd;            // 1 TRY = 0.03 USD
      else if (perUsd > 0) k = 1 / perUsd; // 1 USD = 33 TRY → 1 TRY = 1/33 USD

      if (k > 0) unitToUsd[code] = k;
    }
    unitToUsd['USD'] = 1;

    let updated = 0;
    let skippedNoMatch = 0;
    let skippedNoCost = 0;
    let skippedNoFx = 0;
    let totalCandidates = 0;

    // فهرس: productName -> (normalizedName -> {cost,currency})
    const catalogIndexByProduct = new Map<string, Map<string, { cost?: number; currency?: string }>>();

    for (const cp of catalogProducts) {
      const cpkgs = await this.packagesRepo.find({
        where: { catalogProductId: cp.id },
        take: 10000,
      });
      const map = new Map<string, { cost?: number; currency?: string }>();
      for (const c of cpkgs as any[]) {
        const clean = normalizePkgName(c.name);
        const costRaw = (c.costPrice != null) ? String(c.costPrice) : '';
        const cost = costRaw ? Number(costRaw.replace(',', '.')) : NaN;
        const currency = (c.currencyCode ?? '').toString().toUpperCase() || 'USD';
        map.set(clean, { cost: isNaN(cost) ? undefined : cost, currency });
      }
      catalogIndexByProduct.set(cp.name, map);
    }

    // مرّ على منتجات المتجر المطابقة بالأسماء داخل نفس الـ tenant
    for (const cp of catalogProducts) {
      const sp = await this.shopProducts.findOne({ where: { tenantId, name: cp.name } });
      if (!sp) continue;

      const catMap = catalogIndexByProduct.get(cp.name) || new Map();

      const shopPkgs = await this.shopPackages.find({ where: { tenantId, product: { id: sp.id } } });
      for (const pkg of shopPkgs as any[]) {
        totalCandidates++;

        const key = normalizePkgName(pkg.name);
        const row = catMap.get(key);
        if (!row) { skippedNoMatch++; continue; }

        if (row.cost == null || isNaN(row.cost)) { skippedNoCost++; continue; }

        const cur = (row.currency || 'USD').toUpperCase();
        const fx = unitToUsd[cur];
        if (!fx || fx <= 0) { skippedNoFx++; continue; }

        // السعر بالدولار = التكلفة × (كم دولار لكل 1 وحدة من العملة)
        let usd = row.cost * fx;

        if (mode === 'markup') {
          usd = usd * (1 + (markupPercent / 100));
          usd = usd + fixedFee;
        }

        usd = Math.max(0, Number(usd.toFixed(4)));

        const shouldWrite = overwriteZero ? true : Number(pkg.basePrice || 0) === 0;

        if (shouldWrite) {
          pkg.basePrice = usd;
          await this.shopPackages.save(pkg);
          updated++;
        }
      }
    }

    return {
      ok: true,
      providerId,
      updated,
      skippedNoMatch,
      skippedNoCost,
      skippedNoFx,
      totalCandidates,
      mode,
      markupPercent,
      fixedFee,
    };
  }
}
