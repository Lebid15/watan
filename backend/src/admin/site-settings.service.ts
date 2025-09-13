import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSetting } from './site-setting.entity';

type SettingKey = 'about' | 'infoes';

@Injectable()
export class SiteSettingsService {
  constructor(
    @InjectRepository(SiteSetting)
    private repo: Repository<SiteSetting>,
  ) {}

  async get(tenantId: string, key: SettingKey): Promise<string | null> {
    const row = await this.repo.findOne({ where: { tenantId, key } });
    return row?.value ?? null;
  }

  async set(tenantId: string, key: SettingKey, value: string): Promise<void> {
    // استخدام upsert (ON CONFLICT) لضمان الذرّية وتجنب سباق الشيك ثم الإدراج
    try {
      // TypeORM 0.3+: upsert يدعم تحديد النزاع على الأعمدة المركبة
      await this.repo.upsert({ tenantId, key, value: value ?? '' }, ['tenantId', 'key']);
    } catch (e: any) {
      // حماية إضافية في حال كان هناك قيد قديم لم يُحذف بعد
      if (e?.code === '23505') {
        throw new ConflictException('Duplicate setting key for tenant');
      }
      throw e;
    }
  }
}
