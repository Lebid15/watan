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
    console.log('[PAGES] about: tenantId=', tenantId, 'tenant=', (req as any)?.tenant);
    
    if (!tenantId) {
      console.log('[PAGES] about: no tenantId found, returning 401');
      throw new HttpException('Auth required', HttpStatus.UNAUTHORIZED);
    }
    
    try {
      console.log('[PAGES] about: querying site_settings with tenantId=', tenantId, 'key=about');
      const setting = await this.repo.findOne({ where: { key: 'about', tenantId } });
      console.log('[PAGES] about: found setting=', setting);
      
      if (!setting) {
        console.log('[PAGES] about: no setting found, returning 204');
        throw new HttpException('Page content not found', HttpStatus.NO_CONTENT);
      }
      
      return setting.value ?? '';
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('[PAGES] about: database error=', error);
      throw new HttpException('Failed to fetch about page', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  
  @Get('infoes') 
  async infoes(@Req() req: Request) { 
    const tenantId = (req as any)?.tenant?.id;
    console.log('[PAGES] infoes: tenantId=', tenantId, 'tenant=', (req as any)?.tenant);
    
    if (!tenantId) {
      console.log('[PAGES] infoes: no tenantId found, returning 401');
      throw new HttpException('Auth required', HttpStatus.UNAUTHORIZED);
    }
    
    try {
      console.log('[PAGES] infoes: querying site_settings with tenantId=', tenantId, 'key=infoes');
      const setting = await this.repo.findOne({ where: { key: 'infoes', tenantId } });
      console.log('[PAGES] infoes: found setting=', setting);
      
      if (!setting) {
        console.log('[PAGES] infoes: no setting found, returning 204');
        throw new HttpException('Page content not found', HttpStatus.NO_CONTENT);
      }
      
      return setting.value ?? '';
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('[PAGES] infoes: database error=', error);
      throw new HttpException('Failed to fetch infoes page', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
