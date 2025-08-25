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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import type { Express } from 'express';
import { configureCloudinary } from '../utils/cloudinary';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

function getCloud() {
  return configureCloudinary();
}

@Controller('admin/upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.DEVELOPER, UserRole.ADMIN)
export class UploadController {
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
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
  throw new BadRequestException({ code: 'no_file', message: 'لم يتم استلام أي ملف' });
    }

    try {
      const cloudinary = getCloud();
      const result = await new Promise<{ secure_url: string }>((resolve, reject) => {
        // Debug معلومات عن الملف
        // eslint-disable-next-line no-console
        console.log('[Admin Upload][DEBUG] incoming file', {
          originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            bufferLen: file.buffer?.length,
        });
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'watan',
            resource_type: 'image',
          },
          (err, res) => {
            // eslint-disable-next-line no-console
            console.log('[Admin Upload][DEBUG] cloudinary callback', {
              hasErr: !!err,
              errType: err && typeof err,
              errKeys: err && Object.keys(err || {}),
              errMessage: err?.message,
              resHasError: !!(res as any)?.error,
              resError: (res as any)?.error,
            });
            if (err) return reject(err);
            if ((res as any)?.error) return reject((res as any).error);
            if (!res) return reject(new Error('Empty Cloudinary response'));
            resolve(res as any);
          },
        );
        stream.on('error', (e) => {
          // eslint-disable-next-line no-console
          console.error('[Admin Upload][DEBUG] stream error event', {
            message: (e as any)?.message,
            name: (e as any)?.name,
          });
          reject(e);
        });
        stream.end(file.buffer);
      });

      return { url: result.secure_url, secure_url: result.secure_url };
    } catch (err: any) {
      const rawMsg: string = err?.message || err?.error?.message || '';
      const httpCode: number | undefined = err?.http_code || err?.statusCode || err?.status;

      // eslint-disable-next-line no-console
      console.error('[Admin Upload] Cloudinary error:', {
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
