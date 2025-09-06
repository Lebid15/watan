// src/products/price-groups.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  NotFoundException,
  Delete,
  Put,
  Patch,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  InternalServerErrorException,
  BadRequestException,
  Query,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Express, Request } from 'express';
import { ProductsService } from './products.service';
import { DataSource } from 'typeorm';
import { UpdatePackageCodeDto } from './dto/update-package-code.dto';
import { Product } from './product.entity';
import { ProductPackage } from './product-package.entity';
import { PriceGroup } from './price-group.entity';
import { AuthGuard } from '@nestjs/passport';
import { configureCloudinary } from '../utils/cloudinary';
// Guards & Roles
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';


function parseMoney(input?: any): number {
  if (input == null) return 0;
  const s = String(input).replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// تهيئة Cloudinary وقت الاستخدام
function getCloud() {
  return configureCloudinary();
}

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService, private readonly dataSource: DataSource) {}


  @Get('price-groups')
  async getPriceGroups(@Req() req: Request): Promise<PriceGroup[]> {
    // ✅ استخدم tenant context من middleware
    return this.productsService.getPriceGroups((req as any).tenant?.id || (req as any).user?.tenantId);
  }

  @Post('price-groups')
  async createPriceGroup(@Req() req: Request, @Body() body: Partial<PriceGroup>): Promise<PriceGroup> {
    // ✅ استخدم tenant context من middleware
    return this.productsService.createPriceGroup((req as any).tenant?.id || (req as any).user?.tenantId, body);
  }

  @Delete('price-groups/:id')
  async deletePriceGroup(@Req() req: Request, @Param('id') id: string) {
    // ✅ استخدم tenant context من middleware
    await this.productsService.deletePriceGroup((req as any).tenant?.id || (req as any).user?.tenantId, id);
    return { message: 'تم حذف المجموعة بنجاح' };
  }

  @Get('users-price-groups')
  async getUsersPriceGroups(@Req() req: Request) {
    // ✅ استخدم tenant context من middleware
    return this.productsService.getUsersPriceGroups((req as any).tenant?.id || (req as any).user?.tenantId);
  }


  // NOTE: Place the more specific static GET routes BEFORE the dynamic ':id' route.
  // Otherwise requests like /products/snapshot-available would be captured as id='snapshot-available'.


  @Get()
  async findAll(@Req() req: Request, @Query('all') all?: string, @Query('includeNull') includeNull?: string): Promise<any[]> {
    const tenantId = (req as any).tenant?.id || (req as any).user?.tenantId;
    console.log('[PRODUCTS] findAll tenantId=', tenantId);
    const wantAll = (all === '1' || all === 'true' || includeNull === '1' || includeNull === 'true');
    const products = wantAll
      ? await this.productsService.findAllWithPackages(tenantId)
      : await this.productsService.getTenantVisibleProducts(tenantId);
    console.log('[PRODUCTS] findAll count=', products.length, 'first.packages?', products[0]?.packages?.length);
    return products.map((product) => ({
      ...product,
      packages: (product.packages || []).map((pk: any) => ({
        ...pk,
        providerName: pk.providerName || null,
      })),
      packagesCount: product.packages?.length ?? 0,
      imageUrl: product.imageUrl,
      imageSource: product.imageSource,
      hasCustomImage: product.hasCustomImage,
      customImageUrl: product.customImageUrl,
      customAltText: (product as any).customAltText ?? null,
    }));
  }

  // ✅ إرجاع قائمة المنتجات العالمية (للاستنساخ) – محمية Roles
  @Get('global')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.INSTANCE_OWNER, UserRole.DEVELOPER)
  async listGlobal(@Req() _req: Request) {
    const data = await this.productsService.listGlobalProducts();
    return { items: data, count: data.length };
  }

  @Get(':id')
  async findOne(@Req() req: Request, @Param('id') id: string, @Query('all') all?: string, @Query('includeNull') includeNull?: string): Promise<any> {
    const tenantId = (req as any).tenant?.id || (req as any).user?.tenantId;
    console.log('[PRODUCTS] findOne tenantId=', tenantId, 'productId=', id);
    const wantAll = (all === '1' || all === 'true' || includeNull === '1' || includeNull === 'true');
    const product = wantAll
      ? await this.productsService.findOneWithPackages(tenantId, id)
      : await this.productsService.getTenantVisibleProductById(tenantId, id);
    if (!product) throw new NotFoundException('معرف المنتج غير صالح');
    return {
      ...product,
      packages: (product.packages || []).map((pk: any) => ({
        ...pk,
        providerName: pk.providerName || null,
      })),
      imageUrl: product.imageUrl,
      imageSource: product.imageSource,
      hasCustomImage: product.hasCustomImage,
      customImageUrl: product.customImageUrl,
      customAltText: (product as any).customAltText ?? null,
    };
  }

  @Post()
  async create(@Req() req: Request, @Body() body: Partial<Product>): Promise<Product> {
    // إنشاء منتج للمستأجر فقط (بدون fallback عالمي). يجب أن يكون هناك tenantId.
    let tenantId = (req as any).tenant?.id || (req as any).user?.tenantId;
    // 🔁 Fallback: السماح للمطور / instance_owner بتمرير X-Tenant-Host لتحديد المستأجر أثناء العمل على الدومين الجذري (www / api)
    if (!tenantId) {
      const role = ((req as any).user?.roleFinal || (req as any).user?.role || '').toLowerCase();
      if (['developer', 'instance_owner'].includes(role)) {
        const rawHost = (req.headers['x-tenant-host'] || req.headers['X-Tenant-Host']) as string | undefined;
        if (rawHost) {
          const host = rawHost.toLowerCase().trim();
          try {
            const row = await this.dataSource.query(`SELECT "tenantId" FROM tenant_domain WHERE lower(domain) = $1 LIMIT 1`, [host]);
            const resolved = row?.[0]?.tenantId;
            if (resolved) {
              tenantId = resolved;
              (req as any).tenant = { id: tenantId };
              console.log('[PRODUCTS][CREATE] resolved tenant from X-Tenant-Host header host=%s tenantId=%s', host, tenantId);
            } else {
              console.warn('[PRODUCTS][CREATE] X-Tenant-Host not found in tenant_domain host=%s', host);
            }
          } catch (e: any) {
            console.warn('[PRODUCTS][CREATE] failed lookup tenant_domain for host', host, e?.message);
          }
        }
      }
    }
    if (!tenantId) throw new BadRequestException('tenantId مفقود لإنشاء منتج مستأجر');
    console.log('[PRODUCTS] create tenant product tenantId=', tenantId, 'body=', body);
    const AUTO_DEFAULT_BASE = 'منتج جديد';
    const product = new Product();
    const providedName = (body.name || '').trim();
    const usingAuto = !providedName;
    product.name = providedName || AUTO_DEFAULT_BASE; // اسم افتراضي مبدئي
    product.description = body.description ?? '';
    product.isActive = body.isActive ?? true;
    product.tenantId = tenantId;
    try {
      const created = await this.productsService.create(product);
      return created;
    } catch (err: any) {
      // Postgres unique violation
      if (err?.code === '23505') {
        // إن كان الاسم مولَّداً تلقائياً نجرب إعادة المحاولة مع لاحقة
        if (usingAuto) {
          for (let i = 2; i <= 6; i++) {
            const trial = `${AUTO_DEFAULT_BASE}-${i}`;
            product.name = trial;
            try {
              const saved = await this.productsService.create(product);
              console.warn('[PRODUCTS][CTRL][CREATE][AUTO-RETRY-SUCCESS]', { tenantId, name: trial });
              return saved;
            } catch (e2: any) {
              if (e2?.code === '23505') {
                continue; // جرّب اسم آخر
              }
              // خطأ آخر أثناء إعادة المحاولة
              console.error('[PRODUCTS][CTRL][CREATE][AUTO-RETRY-ERROR]', { tenantId, trial, message: e2?.message, code: e2?.code });
              throw new InternalServerErrorException('فشل إنشاء المنتج (محاولة تلقائية)');
            }
          }
          console.error('[PRODUCTS][CTRL][CREATE][AUTO-FAILED-ALL]', { tenantId });
          throw new ConflictException('تعذّر إيجاد اسم افتراضي متاح للمنتج، يرجى اختيار اسم يدوي');
        }
        console.error('[PRODUCTS][CTRL][CREATE][UNIQUE]', { tenantId, name: product.name, code: err.code, detail: err?.detail });
        throw new ConflictException('اسم المنتج موجود مسبقاً داخل هذا المستأجر');
      }
      console.error('[PRODUCTS][CTRL][CREATE][ERROR]', {
        tenantId,
        body,
        message: err?.message,
        code: err?.code,
        detail: err?.detail,
        stack: err?.stack?.split('\n')?.slice(0, 3).join(' | '),
      });
      throw new InternalServerErrorException('فشل إنشاء المنتج');
    }
  }

  @Put(':id')
  async update(@Req() req: Request, @Param('id') id: string, @Body() body: Partial<Product>): Promise<Product> {
    // ✅ استخدم tenant context من middleware
    const tenantId = (req as any).tenant?.id || (req as any).user?.tenantId;
    console.log('[PRODUCTS] update tenantId=', tenantId, 'productId=', id);
    return this.productsService.update(tenantId, id, body);
  }

  @Delete(':id')
  async delete(@Req() req: Request, @Param('id') id: string): Promise<{ message: string }> {
    const tenantId = (req as any).tenant?.id || (req as any).user?.tenantId;
    const role = (req as any).user?.roleFinal || (req as any).user?.role;
    console.log('[PRODUCTS] delete tenantId=', tenantId, 'productId=', id, 'role=', role);
    await this.productsService.delete({ tenantId, role }, id);
    return { message: 'تم حذف المنتج بنجاح' };
  }

  // إنشاء منتج عالمي (للكتالوج) مخصص للمطور فقط
  @Post('global')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DEVELOPER, UserRole.INSTANCE_OWNER)
  async createGlobal(@Req() req: Request, @Body() body: Partial<Product>): Promise<Product> {
    const role = (req as any).user?.roleFinal || (req as any).user?.role;
    const roleLower = (role || '').toLowerCase();
    if (!(roleLower === 'developer' || roleLower === 'instance_owner')) throw new ForbiddenException('غير مصرح');
    const GLOBAL_ID = '00000000-0000-0000-0000-000000000000';
    const product = new Product();
    const AUTO_DEFAULT_BASE = 'منتج عالمي';
    const providedName = (body.name || '').trim();
    const usingAuto = !providedName;
    product.name = providedName || AUTO_DEFAULT_BASE;
    product.description = body.description ?? '';
    product.isActive = body.isActive ?? true;
    product.tenantId = GLOBAL_ID;
    console.log('[PRODUCTS] create global product by=', roleLower, 'name=', product.name);
    try {
      const created = await this.productsService.create(product);
      return created;
    } catch (err: any) {
      if (err?.code === '23505' && usingAuto) {
        for (let i = 2; i <= 5; i++) {
          product.name = `${AUTO_DEFAULT_BASE}-${i}`;
          try { return await this.productsService.create(product); } catch(e2:any){ if (e2?.code==='23505') continue; throw e2; }
        }
        throw new ConflictException('تعذر اختيار اسم عالمي');
      }
      throw err;
    }
  }

  // ✅ الجسور المتاحة (الأكواد غير المستخدمة بعد) لمنتج مستنسخ
  @Get(':id/bridges')
  @UseGuards(AuthGuard('jwt'))
  async getAvailableBridges(@Req() req: Request, @Param('id') id: string) {
    const tenantId = (req as any).tenant?.id || (req as any).user?.tenantId;
    if (!tenantId) throw new BadRequestException('لا يمكن تحديد التينانت');
    const available = await this.productsService.getAvailableBridges(tenantId, id);
    return { available };
  }

  // ✅ استنساخ منتج عالمي إلى تينانت المستأجر الحالي
  @Post(':id/clone-to-tenant')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.INSTANCE_OWNER, UserRole.DEVELOPER)
  async cloneToTenant(@Req() req: Request, @Param('id') globalProductId: string) {
    const targetTenantId = (req as any).tenant?.id || (req as any).user?.tenantId;
    if (!targetTenantId) {
      throw new BadRequestException('لا يمكن تحديد التينانت الهدف');
    }
    const cloned = await this.productsService.cloneGlobalProductToTenant(globalProductId, targetTenantId);
    return {
      message: 'تم الاستنساخ بنجاح',
      product: {
        id: cloned.id,
        name: cloned.name,
        isActive: cloned.isActive,
        description: cloned.description || null,
        packages: (cloned.packages || []).map(p => ({
          id: p.id,
          name: p.name,
          publicCode: p.publicCode,
          isActive: p.isActive,
          imageUrl: p.imageUrl || null,
          providerName: p.providerName || null,
        })),
      },
    };
  }


  // (moved catalog-available & snapshot-available routes above @Get(':id') to avoid dynamic capture)


  // 🔹 رفع صورة المنتج إلى Cloudinary
  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(png|jpe?g|webp|gif|bmp|svg\+xml)$/i.test(file.mimetype);
        if (!ok) return cb(new Error('Only image files are allowed'), false);
        cb(null, true);
      },
    }),
  )
  async uploadProductImage(@Req() req: Request, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new NotFoundException('لم يتم تقديم ملف (image)');

    try {
      const cloudinary = getCloud();
      const result: any = await new Promise((resolve, reject) => {
        const upload = cloudinary.uploader.upload_stream(
          { folder: 'products', resource_type: 'image' },
          (error, uploadResult) => (error ? reject(error) : resolve(uploadResult)),
        );
        upload.end(file.buffer);
      });

      if (!result?.secure_url) {
        throw new Error('Cloudinary did not return secure_url');
      }
  const tenantId = (req as any).tenant?.id || (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000000';
  return this.productsService.updateImage(tenantId, id, result.secure_url);
    } catch (err: any) {
      console.error('[Upload Product Image] Cloudinary error:', {
        message: err?.message,
        name: err?.name,
        http_code: err?.http_code,
      });
      throw new InternalServerErrorException('فشل رفع الصورة، تحقق من إعدادات Cloudinary.');
    }
  }

  // 🔹 إنشاء باقة جديدة مع رفع صورة + تمرير السعر
  @Post(':id/packages')
  // ✅ إضافة الحماية المفقودة: بدون الحارس كان req.user undefined وبالتالي tenantId يسقط إلى الحاوية العامة
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DEVELOPER, UserRole.INSTANCE_OWNER)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(png|jpe?g|webp|gif|bmp|svg\+xml)$/i.test(file.mimetype);
        if (!ok) return cb(new Error('Only image files are allowed'), false);
        cb(null, true);
      },
    }),
  )
  async addPackage(
    @Req() req: Request,
    @Param('id') productId: string,
    @UploadedFile() file: Express.Multer.File,
  @Body('name') name: string,
    @Body('capital') capitalStr?: string,
    @Body('basePrice') basePriceStr?: string,
    @Body('price') priceStr?: string,
  @Body('publicCode') publicCodeRaw?: any,
  @Body('isActive') isActiveRaw?: any,
  @Body('providerName') providerName?: string,
  ): Promise<ProductPackage> {
    // Debug log (سيساعد في حالة أي سقوط إلى الحاوية العامة)
    try {
      const dbgUser: any = (req as any).user || null;
      console.log('[PKG][CTRL][ADD][START]', {
        userId: dbgUser?.id || null,
        role: dbgUser?.role || dbgUser?.roleFinal || null,
        tenantCtx: (req as any).tenant?.id || dbgUser?.tenantId || null,
      });
    } catch {}
    if (!name) throw new NotFoundException('اسم الباقة مطلوب');
    // إلزام اختيار رقم الجسر (publicCode) الآن (مرحلة 1) – نسمح برقم صحيح موجب فقط
    if (publicCodeRaw == null || String(publicCodeRaw).trim() === '') {
      throw new BadRequestException('الجسر (publicCode) مطلوب');
    }

    let imageUrl: string | undefined;
    if (file) {
      try {
        const cloudinary = getCloud();
        const result: any = await new Promise((resolve, reject) => {
          const upload = cloudinary.uploader.upload_stream(
            { resource_type: 'image' },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          upload.end(file.buffer);
        });
        imageUrl = result.secure_url;
      } catch (err: any) {
        console.error('[Add Package Image] Cloudinary error:', {
          message: err?.message,
          http_code: err?.http_code,
        });
        throw new InternalServerErrorException('فشل رفع صورة الباقة.');
      }
    }
    const capital = parseMoney(capitalStr ?? basePriceStr ?? priceStr);

    const tenantId = (req as any).tenant?.id || (req as any).user?.tenantId || '00000000-0000-0000-0000-000000000000';
    let publicCode: number | null = null;
    if (publicCodeRaw != null && String(publicCodeRaw).trim() !== '') {
      const pc = Number(publicCodeRaw);
      if (Number.isInteger(pc) && pc > 0) publicCode = pc;
      else throw new BadRequestException('publicCode غير صالح');
    }
    const isActive = (() => {
      if (isActiveRaw === undefined || isActiveRaw === null || isActiveRaw === '') return true;
      if (typeof isActiveRaw === 'boolean') return isActiveRaw;
      const s = String(isActiveRaw).toLowerCase();
      return !(s === '0' || s === 'false' || s === 'no');
    })();
    const providerNameClean = providerName?.trim() || null;

    return this.productsService.addPackageToProduct(
      tenantId,
      productId,
      {
        name,
        imageUrl,
  capital,
  publicCode,
  isActive,
  providerName: providerNameClean,
      },
      { userId: (req as any).user?.id, finalRole: (req as any).user?.roleFinal },
    );
  }

  @Delete('packages/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DEVELOPER, UserRole.INSTANCE_OWNER)
  async deletePackage(@Req() req: Request, @Param('id') id: string): Promise<{ message: string }> {
    // ✅ تمرير السياق الكامل لدعم حذف المطور للباقات العالمية والسجلات
    await this.productsService.deletePackage({
      tenantId: (req as any).tenant?.id || (req as any).user?.tenantId || null,
      role: (req as any).user?.roleFinal || (req as any).user?.role || null,
      userId: (req as any).user?.id || null,
    }, id);
    return { message: 'تم حذف الباقة بنجاح' };
  }

  @Put('packages/:id/prices')
  async updatePackagePrices(
    @Req() req: Request,
    @Param('id') packageId: string,
    @Body() body: { capital: number; prices: { groupId: string; price: number }[] },
  ) {
    // ✅ استخدم tenant context من middleware
    const tenantId = (req as any).tenant?.id || (req as any).user?.tenantId;
    await this.productsService.updatePackagePrices(tenantId, packageId, body);
    const rows = await this.productsService.getPackagesPricesBulk(tenantId, { packageIds: [packageId] });
    return {
      packageId,
      capital: body.capital,
      prices: rows.map(r => ({
        id: r.priceId ?? null,
        groupId: r.groupId,
        groupName: r.groupName,
        price: r.price
      })),
    };
  }

  // ✅ تحديث publicCode لباقـة (Dev/Admin context يفترض الحماية بطبقة أعلى)
  @Patch('packages/:id/code')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DEVELOPER, UserRole.INSTANCE_OWNER)
  async updatePackageCode(
    @Req() req: Request,
    @Param('id') packageId: string,
    @Body() body: UpdatePackageCodeDto,
  ) {
    // يمكن لاحقًا ربط التحقق بالـ tenant إن لزم:
    return this.productsService.updatePackageCode(packageId, body.publicCode);
  }

  // ✅ تعديل أساسي لحقول الباقة (اسم، وصف، basePrice، isActive)
  @Patch('packages/:id/basic')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DEVELOPER, UserRole.INSTANCE_OWNER)
  async updatePackageBasic(
    @Req() req: Request,
    @Param('id') packageId: string,
    @Body() body: { name?: string; description?: string | null; basePrice?: number; isActive?: boolean },
  ) {
    const tenantId = (req as any).tenant?.id || (req as any).user?.tenantId;
    return this.productsService.updatePackageBasic(tenantId, packageId, body);
  }

  // دعم قديم: PUT /products/packages/:id لتحديث حقول بسيطة (الاسم / الحالة)
  @Put('packages/:id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DEVELOPER, UserRole.INSTANCE_OWNER)
  async legacyUpdatePackage(
    @Req() req: Request,
    @Param('id') packageId: string,
    @Body() body: { name?: string; isActive?: boolean; description?: string | null; basePrice?: number },
  ) {
    const tenantId = (req as any).tenant?.id || (req as any).user?.tenantId;
    return this.productsService.updatePackageBasic(tenantId, packageId, body);
  }

  // ✅ تحديث اسم المزود
  @Patch('packages/:id/provider')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DEVELOPER, UserRole.INSTANCE_OWNER)
  async updatePackageProvider(
    @Param('id') packageId: string,
    @Body('providerName') providerName: string,
  ) {
    if (!providerName || !providerName.trim()) throw new BadRequestException('providerName مطلوب');
    return this.productsService.updatePackageProvider(packageId, providerName.trim());
  }

  // ✅ إتاحة جلب الكود الحالي لباقة واحدة (مفيد للـ UI للتحديث اللحظي)
  @Get('packages/:id/code')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.DEVELOPER, UserRole.INSTANCE_OWNER)
  async getPackageCode(@Param('id') packageId: string) {
    const pkg = await this.productsService.findPackageById(packageId);
    if (!pkg) throw new NotFoundException('الباقة غير موجودة');
    return { id: pkg.id, publicCode: pkg.publicCode };
  }

  // 🔹 جلب أسعار باقات متعددة (Bulk)
  @Post('packages/prices')
  async getPackagesPricesBulk(
    @Req() req: Request,
    @Body() body: { packageIds: string[]; groupId?: string },
  ) {
    return this.productsService.getPackagesPricesBulk((req as any).user?.tenantId, body);
  }

  @Get('packages/prices')
  async getPackagesPricesQuery(
    @Req() req: Request,
    @Query('packageIds') packageIds: string,
    @Query('groupId') groupId?: string,
  ) {
    if (!packageIds) throw new BadRequestException('packageIds مطلوب');

    const ids = packageIds
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 1000);

    return this.productsService.getPackagesPricesBulk((req as any).tenant?.id || (req as any).user?.tenantId, {
      packageIds: ids,
      groupId,
    });
  }

  // 🔹 واجهات للمستخدم (JWT)
  @UseGuards(AuthGuard('jwt'))
  @Get('user')
  async getAllForUser(@Req() req) {
    // ✅ استخدم tenant context من middleware
    return this.productsService.findAllForUser((req as any).tenant?.id || (req as any).user?.tenantId, req.user.id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('user/:id')
  async getOneForUser(@Req() req, @Param('id') id: string) {
    // ✅ استخدم tenant context من middleware
    return this.productsService.findOneForUser((req as any).tenant?.id || (req as any).user?.tenantId, id, req.user.id);
  }

}
