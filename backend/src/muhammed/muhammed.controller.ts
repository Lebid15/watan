import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MuhammedService } from './muhammed.service';
import { UpsertMuhammedDailyDto } from './dto/upsert-muhammed-daily.dto';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/user-role.enum';
import { RolesGuard } from '../auth/roles.guard';

@Controller('muhammed')
@UseGuards(RolesGuard)
@Roles(UserRole.MUHAMMED)
export class MuhammedController {
  constructor(private readonly service: MuhammedService) {}

  @Get('daily')
  async list() {
    return this.service.list();
  }

  @Post('daily')
  async upsert(@Body() dto: UpsertMuhammedDailyDto) {
    return this.service.upsert(dto);
  }
}
