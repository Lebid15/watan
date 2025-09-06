import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeveloperNote } from './developer-note.entity';

export interface NoteDto { value: string; updatedAt: string | null }

@Injectable()
export class DeveloperNotesService {
  private cache: { value: string; updatedAt: string | null; ts: number } | null = null;
  private readonly ttlMs = 60_000; // 60s
  private readonly maxLen = 5000;
  private readonly logger = new Logger('DevNotes');

  constructor(@InjectRepository(DeveloperNote) private repo: Repository<DeveloperNote>) {}

  private shape(row: DeveloperNote | null): NoteDto {
    return { value: row?.value ?? '', updatedAt: row?.updatedAt?.toISOString() ?? null };
  }

  async getLatest(): Promise<NoteDto> {
    const now = Date.now();
    if (this.cache && now - this.cache.ts < this.ttlMs) {
      return { value: this.cache.value, updatedAt: this.cache.updatedAt };
    }
    try {
      const row = await this.repo.findOne({ where: { singleton: true } });
      const shaped = this.shape(row);
      this.cache = { ...shaped, ts: now };
      return shaped;
    } catch (e) {
      this.logger.error('Failed to load latest developer note', e as any);
      return { value: '', updatedAt: null };
    }
  }

  async set(value: string, actorId: string): Promise<NoteDto> {
    const trimmed = (value || '').slice(0, this.maxLen).trim();
    let row: DeveloperNote | null = null;
    try {
      row = await this.repo.findOne({ where: { singleton: true } });
    } catch (e) {
      this.logger.error('Failed initial fetch of developer note (table may not exist yet)', e as any);
    }
    if (!row) {
      row = this.repo.create({ value: trimmed, singleton: true });
    } else {
      row.value = trimmed;
    }
    try {
      row = await this.repo.save(row);
    } catch (e) {
      this.logger.error('Failed to save developer note', e as any);
      throw e;
    }
    this.cache = { value: row.value, updatedAt: row.updatedAt.toISOString(), ts: Date.now() };
    this.logger.log(`Developer note updated by user=${actorId} len=${trimmed.length}`);
    return this.shape(row);
  }
}
