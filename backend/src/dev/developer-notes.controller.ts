import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { DeveloperNotesService } from './developer-notes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';

@Controller('dev/notes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeveloperNotesController {
  constructor(private readonly service: DeveloperNotesService) {}

  @Get('latest')
  async latest() {
    return this.service.getLatest();
  }

  @Post()
  @Roles(UserRole.DEVELOPER, UserRole.ADMIN)
  async set(@Body('value') value: string, @Req() req: any) {
    return this.service.set(value ?? '', req.user?.id || 'unknown');
  }
}
