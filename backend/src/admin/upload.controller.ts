import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
  ServiceUnavailableException,
  Body,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import type { Express } from 'express';
import { configureCloudinary } from '../utils/cloudinary';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Asset } from '../assets/asset.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { HttpCode } from '@nestjs/common';

function getCloud() {
  return configureCloudinary();
}

@Controller('admin/upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DEVELOPER, UserRole.ADMIN)
export class UploadController {
  constructor(@InjectRepository(Asset) private assetRepo: Repository<Asset>) {}
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = /^image\/(png|jpe?g|webp|gif|bmp|svg\+xml)$/i.test(file.mimetype);
        if (!ok) return cb(new Error('Only image files are allowed'), false);
        cb(null, true);
      },
    }),
  )
  @HttpCode(201)
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('purpose') purpose?: string,
    @Body('productId') productId?: string,
    @Req() req?: any,
  ) {
  const corr: string = req?.headers?.['x-upload-correlation'] || req?.body?.correlationId || `srv-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  // دخول الكنترولر (غير مشروط بـ JWT_DEBUG) لتأكيد أننا استلمنا الطلب
  try { console.log('[Admin Upload][ENTRY]', { corr, hasFile: !!req?.file, authHeader: !!req?.headers?.authorization }); } catch {}
    if (process.env.JWT_DEBUG === '1') {
      // eslint-disable-next-line no-console
      console.log('[Admin Upload][DEBUG] user ctx', {
        hasUser: !!req?.user,
        role: req?.user?.role,
        tenantId: req?.user?.tenantId ?? null,
        userId: req?.user?.id,
        authHeader: !!req?.headers?.authorization,
    corr,
      });
    }
    if (!file) {
  throw new BadRequestException({ code: 'no_file', message: 'لم يتم استلام أي ملف' });
    }

    // استنتاج المستخدم و التينانت (قد يكون developer بلا tenantId)
    const user = req?.user || {};
    const tenantId: string | null = user.tenantId ?? null;
    const role: string = user.role;

    // ضبط purpose الافتراضي
    const rawPurpose = (purpose || '').trim().toLowerCase();
    const finalPurpose = rawPurpose || 'misc';

    // قيود الأدوار: ADMIN (أو user tenant admin) يسمح له فقط products|logo|misc، المطور حر
    if (role !== 'developer') {
      const allowed = ['products', 'logo', 'misc'];
      if (!allowed.includes(finalPurpose)) {
        throw new BadRequestException({ code: 'invalid_purpose', message: 'الغرض غير مسموح لهذا الدور' });
      }
    }

    // بناء مجلد Cloudinary
    // لو tenantId موجود: watan/tenants/{tenantId}/{purpose} وإلا watan/global/{purpose}
    const folder = tenantId ? `watan/tenants/${tenantId}/${finalPurpose}` : `watan/global/${finalPurpose}`;

    try {
      const cloudinary = getCloud();
      const started = Date.now();
      // Debug معلومات عن الملف
      // eslint-disable-next-line no-console
      console.log('[Admin Upload][DEBUG] incoming file', {
        corr,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        bufferLen: file.buffer?.length,
      });

      // تحويل إلى Data URI لتفادي أي مشاكل تدفق (stream)
      const b64 = file.buffer.toString('base64');
      const mime = file.mimetype || 'application/octet-stream';
      const dataUri = `data:${mime};base64,${b64}`;
      let result: any;
      try {
        result = await cloudinary.uploader.upload(dataUri, {
          folder,
          resource_type: 'image',
          overwrite: false,
          unique_filename: true,
        });
      } catch (e: any) {
        // eslint-disable-next-line no-console
        console.error('[Admin Upload][DEBUG] direct upload error', {
          corr,
          message: e?.message,
          name: e?.name,
          http_code: e?.http_code,
          elapsedMs: Date.now() - started,
        });
        throw e;
      }
      // eslint-disable-next-line no-console
      console.log('[Admin Upload][DEBUG] direct upload result', {
        corr,
        hasResult: !!result,
        keys: result && Object.keys(result || {}).slice(0, 12),
        public_id: result?.public_id,
        secure_url_len: result?.secure_url?.length,
        elapsedMs: Date.now() - started,
      });
      // حفظ metadata في جدول assets
      try {
        const asset = this.assetRepo.create({
          tenantId,
          uploaderUserId: user.id || null,
          role,
          purpose: finalPurpose,
          productId: productId || null,
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
        // eslint-disable-next-line no-console
  console.log('[Admin Upload][INFO] asset persisted', { corr, assetId: asset.id, publicId: asset.publicId, tenantId: asset.tenantId, purpose: asset.purpose });
      } catch (e) {
        // eslint-disable-next-line no-console
  console.error('[Admin Upload][WARN] failed to persist asset metadata', { corr, err: e });
      }
      // تحقّق صارم: يجب أن نمتلك secure_url
      if (!result?.secure_url) {
        // eslint-disable-next-line no-console
        console.error('[Admin Upload][ERROR] missing secure_url in Cloudinary response', {
          corr,
          keys: result && Object.keys(result),
          public_id: result?.public_id,
          format: result?.format,
        });
        throw new InternalServerErrorException({ code: 'cloudinary_no_secure_url', message: 'فشل استلام رابط الصورة من Cloudinary' });
      }
      // Log موجز للنتيجة (بدون بيانات حساسة)
      try {
        // eslint-disable-next-line no-console
        console.log('[Admin Upload][INFO] upload success', {
          corr,
          public_id: result.public_id,
          bytes: result.bytes,
          width: result.width,
          height: result.height,
          format: result.format,
          secure_url_len: result.secure_url?.length,
        });
      } catch {}
      return {
        corr,
        ok: true,
        url: result.secure_url,
        secure_url: result.secure_url,
  imageUrl: result.secure_url, // compat alias for older frontend expectations
        secureUrl: result.secure_url, // camelCase alias (احتياطي)
        data: { // غلاف توافق لواجهات قديمة كانت تتوقع data.url
          url: result.secure_url,
          secure_url: result.secure_url,
          imageUrl: result.secure_url,
          secureUrl: result.secure_url,
        },
        public_id: result.public_id,
        bytes: result.bytes,
        width: result.width,
        height: result.height,
        format: result.format,
        folder,
        purpose: finalPurpose,
      };
    } catch (err: any) {
      const rawMsg: string = err?.message || err?.error?.message || '';
      const httpCode: number | undefined = err?.http_code || err?.statusCode || err?.status;

      // eslint-disable-next-line no-console
      console.error('[Admin Upload] Cloudinary error:', {
        corr,
        message: rawMsg,
        name: err?.name,
        http_code: httpCode,
        stack: err?.stack?.split('\n').slice(0, 5).join(' | '),
        raw: err,
      });

      // Classification heuristics
      const lower = rawMsg.toLowerCase();
      const credLike = /invalid api key|invalid signature|not allowed|cloud_name|authentication|authorization/.test(lower);
      const sizeLike = /file size|too large|larger than|maximum allowed/.test(lower);
      const rateLike = /rate limit|too many requests/.test(lower);

      if (sizeLike) {
        throw new BadRequestException({ code: 'file_too_large', message: 'الصورة كبيرة جدًا' });
      }
      if (credLike) {
        throw new UnauthorizedException({ code: 'cloudinary_bad_credentials', message: 'إعدادات Cloudinary غير صحيحة' });
      }
      if (rateLike) {
        throw new ServiceUnavailableException({ code: 'cloudinary_rate_limited', message: 'خدمة الرفع مشغولة مؤقتًا، حاول لاحقًا' });
      }
      // If Cloudinary returned an explicit http code (e.g. 400) propagate as 400 with message
      if (httpCode && httpCode >= 400 && httpCode < 500) {
        throw new BadRequestException({ code: 'cloudinary_error', message: rawMsg || 'فشل رفع الملف (خطأ خارجي)' });
      }
      // Generic fallback
      throw new InternalServerErrorException({ code: 'upload_failed', message: 'فشل رفع الملف، حاول مجددًا أو تحقق من السيرفر.' });
    }
  }
}
