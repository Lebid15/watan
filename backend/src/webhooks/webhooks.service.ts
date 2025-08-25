import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosRequestConfig } from 'axios';
import crypto from 'crypto';

/** Simple outbound webhook dispatcher (fire-and-forget with basic retry). */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger('Webhooks');

  /** Build canonical string for signing (timestamp + payload JSON). */
  private buildSigningPayload(ts: string, body: any): string {
    return `${ts}.${JSON.stringify(body)}`;
  }

  /** Compute hex HMAC SHA256 signature. */
  computeSignature(body: any, ts: string, secret: string): string {
    const data = this.buildSigningPayload(ts, body);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /** Verify (returns boolean). */
  verifySignature(body: any, ts: string, secret: string, signature: string): boolean {
    try {
      const expected = this.computeSignature(body, ts, secret);
      // timing safe compare
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch {
      return false;
    }
  }

  /**
   * Post JSON payload to a webhook URL.
   * Retries up to 2 times on network/5xx errors.
   */
  async postJson(url: string, payload: any, opts?: { timeoutMs?: number; headers?: Record<string,string> }) {
    const timeout = opts?.timeoutMs ?? 4000;
    const headers: Record<string,string> = { 'Content-Type': 'application/json', ...(opts?.headers || {}) };
    const secret = process.env.WEBHOOK_SECRET;
    if (secret) {
      const ts = Date.now().toString();
      const sig = this.computeSignature(payload, ts, secret);
      headers['X-Webhook-Timestamp'] = ts;
      headers['X-Webhook-Signature'] = `t=${ts},v1=${sig}`; // composite header (also expose raw ts for convenience)
    }
    const cfg: AxiosRequestConfig = { url, method: 'POST', data: payload, timeout, headers, validateStatus: () => true };
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await axios(cfg);
        if (res.status >= 200 && res.status < 300) {
          if (attempt > 1) this.logger.log(`webhook ${url} succeeded on retry ${attempt}`);
          return { ok: true, status: res.status };
        }
        // Retry on 5xx or network style status 0
        if (res.status >= 500 && attempt < 3) {
          this.logger.warn(`webhook ${url} got ${res.status} attempt ${attempt}`);
          continue;
        }
        if (res.status < 500) {
          this.logger.warn(`webhook ${url} non-retryable status ${res.status}`);
          return { ok: false, status: res.status };
        }
      } catch (err: any) {
        if (attempt === 3) {
          this.logger.error(`webhook ${url} failed after retries: ${err?.message}`);
          return { ok: false, error: err?.message };
        }
        this.logger.warn(`webhook ${url} error attempt ${attempt}: ${err?.message}`);
      }
    }
    return { ok: false };
  }
}
