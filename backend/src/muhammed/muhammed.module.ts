import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MuhammedDaily } from './muhammed-daily.entity';
import { MuhammedService } from './muhammed.service';
import { MuhammedController } from './muhammed.controller';
import { MuhParty } from './muh-party.entity';
import { MuhSettings } from './muh-settings.entity';
import { MuhExport } from './muh-export.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MuhammedDaily, MuhParty, MuhSettings, MuhExport])],
  providers: [MuhammedService],
  controllers: [MuhammedController],
})
export class MuhammedModule {}
