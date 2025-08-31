import { Controller, Get, Req } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SiteSetting } from '../admin/site-setting.entity';
import { Request } from 'express';

@Controller('pages')
export class PagesController {
  constructor(@InjectRepository(SiteSetting) private repo: Repository<SiteSetting>) {}

  @Get('about')  
  async about(@Req() req: Request) { 
    const tenantId = (req as any)?.tenant?.id;
    if (!tenantId) return '';
    return (await this.repo.findOne({ where: { key: 'about', tenantId } }))?.value ?? ''; 
  }
  
  @Get('infoes') 
  async infoes(@Req() req: Request) { 
    const tenantId = (req as any)?.tenant?.id;
    if (!tenantId) return '';
    return (await this.repo.findOne({ where: { key: 'infoes', tenantId } }))?.value ?? ''; 
  }
}
