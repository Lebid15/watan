import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MuhammedDaily } from './muhammed-daily.entity';
import { UpsertMuhammedDailyDto } from './dto/upsert-muhammed-daily.dto';

@Injectable()
export class MuhammedService {
  constructor(
    @InjectRepository(MuhammedDaily)
    private readonly repo: Repository<MuhammedDaily>,
  ) {}

  async getToday(date: string): Promise<MuhammedDaily | null> {
    return this.repo.findOne({ where: { entryDate: date } });
  }

  async list(limit = 30): Promise<MuhammedDaily[]> {
    return this.repo.find({ order: { entryDate: 'DESC' }, take: limit });
  }

  async upsert(dto: UpsertMuhammedDailyDto): Promise<MuhammedDaily> {
    let entity = await this.repo.findOne({ where: { entryDate: dto.entryDate } });
    if (!entity) {
      entity = this.repo.create({ entryDate: dto.entryDate });
    }
    if (dto.note !== undefined) entity.note = dto.note;
    if (dto.value !== undefined) entity.value = dto.value.toFixed(2);
    return this.repo.save(entity);
  }
}
