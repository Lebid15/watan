import { Controller, Get, Req, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSetting } from '../admin/site-setting.entity';
import { Request } from 'express';

@Controller('pages')
export class PagesController {
  constructor(@InjectRepository(SiteSetting) private repo: Repository<SiteSetting>) {}

  private async hasTenantColumn(): Promise<boolean> {
    const rows = await this.repo.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema='public'
          AND table_name='site_settings'
          AND column_name='tenantId'
        LIMIT 1`
    );
    return rows?.length > 0;
  }

  private async getSettingValue(key: 'about' | 'infoes', tenantId: string | null): Promise<string | null> {
    const hasTenant = await this.hasTenantColumn();

    if (hasTenant) {
      // إذا كان العمود موجودًا: جرّب tenantId أولاً، ثم قيمة عامة (NULL) ثم قيمة عامة بلا عمود (توافقًا)
      const byTenant = tenantId
        ? await this.repo.findOne({ where: { key, tenantId } as any })
        : null;
      if (byTenant?.value != null) return byTenant.value;

      const byNull = await this.repo.findOne({ where: { key, tenantId: null } as any });
      if (byNull?.value != null) return byNull.value;

      const byKeyOnly = await this.repo.findOne({ where: { key } as any });
      if (byKeyOnly?.value != null) return byKeyOnly.value;

      return null;
    } else {
      // لا يوجد tenantId في الجدول: اعتمد المفتاح فقط
      const plain = await this.repo.findOne({ where: { key } as any });
      return plain?.value ?? null;
    }
  }

  @Get('about')
  async about(@Req() req: Request) {
    const tenantId: string | null = (req as any)?.tenant?.id ?? null;
    const value = await this.getSettingValue('about', tenantId);
    if (value == null) throw new HttpException('Page content not found', HttpStatus.NO_CONTENT);
    return value;
  }

  @Get('infoes')
  async infoes(@Req() req: Request) {
    const tenantId: string | null = (req as any)?.tenant?.id ?? null;
    const value = await this.getSettingValue('infoes', tenantId);
    if (value == null) throw new HttpException('Page content not found', HttpStatus.NO_CONTENT);
    return value;
  }
}
