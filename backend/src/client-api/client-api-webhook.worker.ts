import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { ClientApiWebhookOutbox, WebhookOutboxStatus } from './client-api-webhook-outbox.entity';
import { User } from '../user/user.entity';
import { buildCanonicalStringV1, hmacSignV1, sha256Hex } from './client-api-webhook.util';
import * as crypto from 'crypto';

// Retry backoff (seconds) — after last value keep using last (6h)
const BACKOFF_STEPS = [0, 30, 120, 600, 3600, 21600];
const MAX_ATTEMPTS = 10;
const PER_USER_CONCURRENCY = 3; // future: make configurable

@Injectable()
export class ClientApiWebhookWorker {
  private readonly logger = new Logger(ClientApiWebhookWorker.name);
  private inFlightPerUser = new Map<string, number>();

  constructor(
    @InjectRepository(ClientApiWebhookOutbox) private readonly outboxRepo: Repository<ClientApiWebhookOutbox>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Cron(CronExpression.EVERY_5_SECONDS)
  async tick() {
    // Reset in-flight counts each tick
    this.inFlightPerUser.clear();

    // Pull candidates: pending or failed due now
    const now = new Date();
    const candidates = await this.outboxRepo.find({
      where: [
        { status: In(['pending','failed'] as WebhookOutboxStatus[]), next_attempt_at: LessThanOrEqual(now) },
      ] as any,
      take: 50,
      order: { next_attempt_at: 'ASC' as any },
    });
    if (!candidates.length) return;

    for (const row of candidates) {
      if (row.status === 'dead' || row.status === 'succeeded') continue;
      const inflight = this.inFlightPerUser.get(row.userId) || 0;
      if (inflight >= PER_USER_CONCURRENCY) continue;
      // Fire & forget (but await sequentially to simplify concurrency controls here)
      this.inFlightPerUser.set(row.userId, inflight + 1);
      try { await this.dispatchOne(row); } catch (err) {
        this.logger.error(`dispatch error row=${row.id} ${(err as any)?.message}`);
      } finally {
        this.inFlightPerUser.set(row.userId, (this.inFlightPerUser.get(row.userId)||1)-1);
      }
    }
  }

  private calcNext(attempt: number): Date {
    const idx = Math.min(attempt, BACKOFF_STEPS.length - 1);
    const sec = BACKOFF_STEPS[idx];
    return new Date(Date.now() + sec * 1000);
  }

  async dispatchOne(row: ClientApiWebhookOutbox) {
    const user = await this.userRepo.findOne({ where: { id: row.userId } as any });
    if (!user || !user.apiWebhookSecret || !user.apiWebhookEnabled || !user.apiWebhookUrl) {
      // Mark dead (configuration missing now)
      row.status = 'dead';
      row.last_error = 'Configuration missing (secret/url/enabled)';
      await this.outboxRepo.save(row);
      return;
    }

    // Update status -> delivering
    row.status = 'delivering';
    row.updated_at = new Date();
    await this.outboxRepo.save(row);

    const body = JSON.stringify(row.payload_json);
    const url = row.delivery_url;
    const u = new URL(url);
    const method = 'POST';
    const timestamp = Math.floor(Date.now()/1000);
    const nonce = crypto.randomUUID();
    const bodyHash = sha256Hex(body);
    const canonical = buildCanonicalStringV1(method, u.pathname || '/', timestamp, nonce, bodyHash);
    const sig = hmacSignV1(user.apiWebhookSecret, canonical);

    const headers: Record<string,string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature-Version': user.apiWebhookSigVersion || 'v1',
      'X-Webhook-Timestamp': String(timestamp),
      'X-Webhook-Nonce': nonce,
      'X-Webhook-Signature': sig,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s total
    let respCode: number | undefined; let respSnippet: string | undefined;
    try {
  const resp = await fetch(url, { method, body, headers, signal: controller.signal } as any);
      respCode = resp.status;
      if (!resp.ok) {
        const text = await resp.text().catch(()=> '');
        respSnippet = text.slice(0,512);
        throw new Error(`HTTP ${resp.status}`);
      }
      // success 2xx
      row.status = 'succeeded';
      row.response_code = respCode || null;
      row.last_error = null;
      row.next_attempt_at = null;
      row.updated_at = new Date();
      await this.outboxRepo.save(row);
    } catch (err: any) {
      clearTimeout(timeout);
      // failure
      row.attempt_count += 1;
      row.response_code = respCode || null;
      const attempt = row.attempt_count;
      if (attempt >= MAX_ATTEMPTS) {
        row.status = 'dead';
      } else {
        row.status = 'failed';
        row.next_attempt_at = this.calcNext(attempt);
      }
      const msg = (err?.message || 'error').slice(0, 120);
      row.last_error = `${msg}${respSnippet? ' '+respSnippet: ''}`.slice(0,512);
      row.updated_at = new Date();
      await this.outboxRepo.save(row);
    } finally {
      clearTimeout(timeout);
    }
  }
}
