import { Controller, Get, Post, Body, UseGuards, Req, InternalServerErrorException } from '@nestjs/common';
import { DeveloperNotesService } from './developer-notes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@Controller('dev/notes')
export class DeveloperNotesController {
  constructor(private readonly service: DeveloperNotesService) {}

  // Public read endpoint (no auth) so tenant storefronts can fetch the note
  @Get('public/latest')
  async publicLatest() { return this.service.getLatest(); }

  // Authenticated latest (kept for dev/admin internal pages)
  @Get('latest')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async latest() { return this.service.getLatest(); }

  @Post()
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async set(@Body('value') value: string, @Req() req: any) {
    try {
      return await this.service.set(value ?? '', req.user?.id || 'unknown');
    } catch (e: any) {
      // Surface a clearer message (logged in service already)
      throw new InternalServerErrorException({ message: 'FAILED_SAVE_DEVELOPER_NOTE', detail: e?.message || String(e) });
    }
  }
}
