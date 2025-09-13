import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as crypto from 'crypto';
let Redis: any; try { Redis = require('ioredis'); } catch {}

interface StoredChallenge { challenge: string; expiresAt: number; type: 'reg' | 'auth'; userId?: string; }

@Injectable()
export class PasskeyChallengeStore implements OnModuleDestroy {
  private readonly log = new Logger(PasskeyChallengeStore.name);
  private memory = new Map<string, StoredChallenge>();
  private redis: any = null;
  private ttlMs = 5 * 60 * 1000;
  private cleaner: any;

  constructor() {
    // In test environment always use in-memory to avoid flakey redis connection / open handles
    const isTest = process.env.NODE_ENV === 'test';
    const url = process.env.REDIS_URL;
    if (!isTest && url && Redis) {
      try {
        this.redis = new Redis(url, { lazyConnect: true });
        this.redis.on('error', (e: any) => this.log.warn('Redis error: ' + e?.message));
        this.redis.connect().catch(() => {
          // connection failure -> fallback to memory only
          this.log.warn('Redis connect failed; falling back to in-memory challenge store');
          this.redis = null;
        });
      } catch (e: any) {
        this.log.warn('Redis init error; using memory only: ' + e?.message);
        this.redis = null;
      }
    }
    // periodic cleanup (disabled in tests to reduce open handles)
    if (!(process.env.NODE_ENV === 'test' && process.env.TEST_DISABLE_SCHEDULERS === 'true')) {
      this.cleaner = setInterval(() => this.cleanup(), 60_000);
      if ((this.cleaner as any)?.unref) (this.cleaner as any).unref();
    }
  }

  async onModuleDestroy() {
    if (this.cleaner) {
      try { clearInterval(this.cleaner); } catch {}
    }
    if (this.redis) {
      try { await this.redis.quit(); } catch { /* ignore */ }
    }
  }

  private key(k: string) { return `passkey:challenge:${k}`; }

  async create(type: 'reg'|'auth', userId?: string): Promise<string> {
    const challenge = crypto.randomBytes(32).toString('base64url');
    const data: StoredChallenge = { challenge, expiresAt: Date.now() + this.ttlMs, type, userId };
    const id = crypto.randomUUID();
    if (this.redis) {
      try {
        await this.redis.set(this.key(id), JSON.stringify(data), 'PX', this.ttlMs);
      } catch (e: any) {
        this.log.warn('Redis set failed; reverting to memory store: ' + e?.message);
        this.redis = null;
        this.memory.set(id, data);
      }
    } else {
      this.memory.set(id, data);
    }
    return `${id}.${challenge}`; // composite given to client (id embedded)
  }

  async consume(composite: string, expectedType: 'reg'|'auth', userId?: string): Promise<string | null> {
    if (!composite || !composite.includes('.')) return null;
    const [id, providedChallenge] = composite.split('.',2);
    let stored: StoredChallenge | null = null;
    if (this.redis) {
      try {
        const raw = await this.redis.get(this.key(id));
        if (raw) stored = JSON.parse(raw);
        if (raw) await this.redis.del(this.key(id));
      } catch (e: any) {
        this.log.warn('Redis get/del failed; switching to memory: ' + e?.message);
        this.redis = null;
      }
    }
    if (!stored) {
      stored = this.memory.get(id) || null;
      if (stored) this.memory.delete(id);
    }
    if (!stored) return null;
    if (stored.type !== expectedType) return null;
    if (Date.now() > stored.expiresAt) return null;
    if (userId && stored.userId && stored.userId !== userId) return null;
    if (stored.challenge !== providedChallenge) return null;
    return stored.challenge;
  }

  // New flow: client sends back only an opaque id (challengeRef). We return stored challenge for verification.
  async consumeById(id: string, expectedType: 'reg'|'auth', userId?: string): Promise<string | null> {
    if (!id) return null;
    let stored: StoredChallenge | null = null;
    if (this.redis) {
      try {
        const raw = await this.redis.get(this.key(id));
        if (raw) stored = JSON.parse(raw);
        if (raw) await this.redis.del(this.key(id));
      } catch (e: any) {
        this.log.warn('Redis get/del failed; switching to memory: ' + e?.message);
        this.redis = null;
      }
    }
    if (!stored) {
      stored = this.memory.get(id) || null;
      if (stored) this.memory.delete(id);
    }
    if (!stored) return null;
    if (stored.type !== expectedType) return null;
    if (Date.now() > stored.expiresAt) return null;
    if (userId && stored.userId && stored.userId !== userId) return null;
    return stored.challenge;
  }

  private cleanup() {
    const now = Date.now();
    for (const [k,v] of this.memory.entries()) {
      if (v.expiresAt < now) this.memory.delete(k);
    }
  }
}
