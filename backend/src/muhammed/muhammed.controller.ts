import { Body, Controller, Get, Post, Patch, Param, Query, UseGuards, Delete } from '@nestjs/common';
import { MuhammedService } from './muhammed.service';
import { UpsertMuhammedDailyDto } from './dto/upsert-muhammed-daily.dto';
import { MuhAddPartyDto } from './dto/muh-add-party.dto';
import { MuhUpdatePartyDto } from './dto/muh-update-party.dto';
import { MuhUpdateRateDto } from './dto/muh-update-rate.dto';
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

  // ===== Sheet endpoints =====
  @Get('sheet')
  async getSheet() {
    return this.service.getSheet();
  }

  @Post('party')
  async addParty(@Body() dto: MuhAddPartyDto) {
    return this.service.addParty(dto.name);
  }

  @Patch('party/:id')
  async updateParty(@Param('id') id: string, @Body() dto: MuhUpdatePartyDto) {
    return this.service.updateParty(id, dto);
  }

  @Delete('party/:id')
  async deleteParty(@Param('id') id: string) {
    return this.service.deleteParty(id);
  }

  @Patch('rate')
  async updateRate(@Body() dto: MuhUpdateRateDto) {
    return this.service.updateRate(dto.rate);
  }

  @Post('export')
  async createExport() {
    return this.service.createExport();
  }

  @Get('exports')
  async listExports(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.listExports({ from, to });
  }

  @Get('exports/:id')
  async getExport(@Param('id') id: string) {
    return this.service.getExport(id);
  }
}
