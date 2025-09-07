import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MuhammedDaily } from './muhammed-daily.entity';
import { MuhammedService } from './muhammed.service';
import { MuhammedController } from './muhammed.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MuhammedDaily])],
  providers: [MuhammedService],
  controllers: [MuhammedController],
})
export class MuhammedModule {}
