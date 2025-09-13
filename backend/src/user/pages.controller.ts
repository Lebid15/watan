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
      // 1) قيمة خاصة بالمستأجر
      if (tenantId) {
        const byTenant = await this.repo.findOne({ where: { key, tenantId } as any });
        if (byTenant?.value != null) return byTenant.value;
      }
      // 2) قيمة افتراضية عامة (tenantId NULL) فقط – لا رجوع لأي مستأجر آخر
      const globalDefault = await this.repo.findOne({ where: { key, tenantId: null } as any });
      return globalDefault?.value ?? null;
    }

    // وضع التوافق القديم (قبل وجود عمود tenantId)
    const legacy = await this.repo.findOne({ where: { key } as any });
    return legacy?.value ?? null;
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
