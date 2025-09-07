import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { MuhammedDaily } from './muhammed-daily.entity';
import { MuhParty } from './muh-party.entity';
import { MuhSettings } from './muh-settings.entity';
import { MuhExport } from './muh-export.entity';
import { UpsertMuhammedDailyDto } from './dto/upsert-muhammed-daily.dto';

@Injectable()
export class MuhammedService {
  constructor(
    @InjectRepository(MuhammedDaily) private readonly repo: Repository<MuhammedDaily>,
    @InjectRepository(MuhParty) private readonly parties: Repository<MuhParty>,
    @InjectRepository(MuhSettings) private readonly settings: Repository<MuhSettings>,
    @InjectRepository(MuhExport) private readonly exportsRepo: Repository<MuhExport>,
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

  // ===== Sheet logic =====
  async ensureSettings(): Promise<MuhSettings> {
    let s = await this.settings.findOne({ where: { id: 1 } });
    if (!s) {
      s = this.settings.create({ id: 1, usd_to_try: '30' });
      s = await this.settings.save(s);
    }
    return s;
  }

  async getSheet() {
    const [rows, settings, lastExport] = await Promise.all([
      this.parties.find({ order: { name: 'ASC' } }),
      this.ensureSettings(),
      this.exportsRepo.find({ order: { created_at: 'DESC' }, take: 1 }),
    ]);
    const rate = parseFloat(settings.usd_to_try || '0') || 0;
    let sumTry = 0; let sumUsd = 0;
    rows.forEach(r => { sumTry += parseFloat(r.debt_try || '0'); sumUsd += parseFloat(r.debt_usd || '0'); });
    const totalUsd = sumUsd + (rate ? (sumTry / rate) : 0);
    const lastExp = lastExport[0];
    let profit: number | null = null;
    if (lastExp) {
      profit = totalUsd - parseFloat(lastExp.total_usd_at_export);
    }
    return {
      rate,
      parties: rows.map(r => ({ ...r, debt_try: parseFloat(r.debt_try), debt_usd: parseFloat(r.debt_usd) })),
      sums: { debt_try: sumTry, debt_usd: sumUsd, total_usd: totalUsd },
      lastExport: lastExp || null,
      profit,
    };
  }

  async addParty(name: string) {
    const p = this.parties.create({ name, debt_try: '0', debt_usd: '0' });
    return this.parties.save(p);
  }

  async updateParty(id: string, patch: Partial<{ name: string; debt_try: number; debt_usd: number; note: string | null; }>) {
    const p = await this.parties.findOne({ where: { id } });
    if (!p) throw new Error('Party not found');
    if (patch.name !== undefined) p.name = patch.name;
    if (patch.debt_try !== undefined) p.debt_try = patch.debt_try.toFixed(2);
    if (patch.debt_usd !== undefined) p.debt_usd = patch.debt_usd.toFixed(2);
    if (patch.note !== undefined) p.note = patch.note;
    return this.parties.save(p);
  }

  async updateRate(rate: number) {
    const s = await this.ensureSettings();
    s.usd_to_try = rate.toFixed(4);
    await this.settings.save(s);
    return { ok: true, rate: parseFloat(s.usd_to_try) };
  }

  async createExport() {
    const sheet = await this.getSheet();
    const exp = this.exportsRepo.create({
      total_usd_at_export: sheet.sums.total_usd.toFixed(4),
      usd_to_try_at_export: sheet.rate.toFixed(4),
    });
    return this.exportsRepo.save(exp);
  }

  async listExports(opts: { from?: string; to?: string }) {
    const where: any = {};
    if (opts.from && opts.to) {
      where.created_at = Between(new Date(opts.from), new Date(opts.to));
    } else if (opts.from) {
      where.created_at = Between(new Date(opts.from), new Date());
    }
    return this.exportsRepo.find({ where, order: { created_at: 'DESC' }, take: 200 });
  }
}
