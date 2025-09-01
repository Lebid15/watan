import { Controller, Get, Req, HttpException, HttpStatus } from '@nestjs/common';
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
    if (!tenantId) {
      throw new HttpException('Tenant not found', HttpStatus.UNAUTHORIZED);
    }
    
    try {
      const setting = await this.repo.findOne({ where: { key: 'about', tenantId } });
      return setting?.value ?? '';
    } catch (error) {
      throw new HttpException('Failed to fetch about page', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  @Get('infoes') 
  async infoes(@Req() req: Request) { 
    const tenantId = (req as any)?.tenant?.id;
    if (!tenantId) {
      throw new HttpException('Tenant not found', HttpStatus.UNAUTHORIZED);
    }
    
    try {
      const setting = await this.repo.findOne({ where: { key: 'infoes', tenantId } });
      return setting?.value ?? '';
    } catch (error) {
      throw new HttpException('Failed to fetch infoes page', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
