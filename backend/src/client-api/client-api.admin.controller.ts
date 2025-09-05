import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { UserApiTokenRotation } from './user-api-token-rotation.entity';
import { ClientApiRequestLog } from './client-api-request-log.entity';
import { ClientApiStatsDaily } from './client-api-stats-daily.entity';
import { ProductApiMetadata } from '../products/product-api-metadata.entity';
import { Product } from '../products/product.entity';
import { buildCanonicalStringV1, generateWebhookSecret, hmacSignV1, sha256Hex } from './client-api-webhook.util';
import { randomUUID } from 'crypto';
import * as crypto from 'crypto';

function hexToken(len = 40) { return crypto.randomBytes(Math.ceil(len/2)).toString('hex').slice(0,len); }

@ApiExcludeController()
@Controller('/api/tenant/client-api')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientApiAdminController {
  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(UserApiTokenRotation) private rotationsRepo: Repository<UserApiTokenRotation>,
    @InjectRepository(ClientApiRequestLog) private logsRepo: Repository<ClientApiRequestLog>,
    @InjectRepository(ClientApiStatsDaily) private statsDailyRepo: Repository<ClientApiStatsDaily>,
    @InjectRepository(ProductApiMetadata) private productMetaRepo: Repository<ProductApiMetadata>,
    @InjectRepository(Product) private productsRepo: Repository<Product>,
  ) {}

  private ensureOwner(req: any) {
    const role = req.user?.roleFinal || req.user?.role;
    if (role !== 'tenant_owner') throw new Error('FORBIDDEN');
  }

  @Post('users/:id/generate')
  async generate(@Req() req: any, @Param('id') userId: string) {
    this.ensureOwner(req);
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
    if (!user) throw new Error('NOT_FOUND');
    const token = hexToken(40);
    user.apiToken = token;
    user.apiTokenRevoked = false;
    user.apiEnabled = true;
    await this.usersRepo.save(user);
    await this.rotationsRepo.insert({ userId: user.id, oldToken: null });
    return { token };
  }

  @Post('users/:id/rotate')
  async rotate(@Req() req: any, @Param('id') userId: string) {
    this.ensureOwner(req);
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
    if (!user) throw new Error('NOT_FOUND');
    const old = user.apiToken || null;
    const token = hexToken(40);
    user.apiToken = token;
    user.apiTokenRevoked = false;
    user.apiEnabled = true;
    await this.usersRepo.save(user);
    await this.rotationsRepo.insert({ userId: user.id, oldToken: old });
    return { token };
  }

  @Post('users/:id/revoke')
  async revoke(@Req() req: any, @Param('id') userId: string) {
    this.ensureOwner(req);
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
    if (!user) throw new Error('NOT_FOUND');
    user.apiTokenRevoked = true;
    await this.usersRepo.save(user);
    return { revoked: true };
  }

  @Post('users/:id/enable')
  async enable(@Req() req: any, @Param('id') userId: string) {
    this.ensureOwner(req);
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
    if (!user) throw new Error('NOT_FOUND');
    user.apiEnabled = true;
    await this.usersRepo.save(user);
    return { enabled: true };
  }

  @Get('users/:id/settings')
  async getSettings(@Req() req: any, @Param('id') userId: string) {
    this.ensureOwner(req);
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
    if (!user) throw new Error('NOT_FOUND');
    return {
      allowAll: user.apiAllowAllIps !== false,
      allowIps: user.apiAllowIps || [],
      webhookUrl: user.apiWebhookUrl || null,
      enabled: !!user.apiEnabled,
      revoked: !!user.apiTokenRevoked,
      lastUsedAt: user.apiLastUsedAt || null,
      rateLimitPerMin: user.apiRateLimitPerMin || null,
      webhook: {
        enabled: !!user.apiWebhookEnabled,
        url: user.apiWebhookUrl || null,
        sigVersion: user.apiWebhookSigVersion || 'v1',
        hasSecret: !!user.apiWebhookSecret,
        lastRotatedAt: user.apiWebhookLastRotatedAt || null,
      },
    };
  }

  @Patch('users/:id/settings')
  async updateSettings(@Req() req: any, @Param('id') userId: string, @Body() body: { allowAll?: boolean; allowIps?: string[]; webhookUrl?: string | null; enabled?: boolean; rateLimitPerMin?: number | null; }) {
    this.ensureOwner(req);
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
    if (!user) throw new Error('NOT_FOUND');
    if (body.allowAll !== undefined) user.apiAllowAllIps = body.allowAll;
    if (Array.isArray(body.allowIps)) user.apiAllowIps = body.allowIps.filter(ip => typeof ip === 'string' && ip.length <= 64);
    if (body.webhookUrl !== undefined) user.apiWebhookUrl = body.webhookUrl || null;
    if (body.enabled !== undefined) user.apiEnabled = body.enabled;
    if (body.rateLimitPerMin !== undefined) {
      if (body.rateLimitPerMin === null) user.apiRateLimitPerMin = null;
      else if (typeof body.rateLimitPerMin === 'number' && body.rateLimitPerMin >= 1 && body.rateLimitPerMin <= 10000) {
        user.apiRateLimitPerMin = Math.floor(body.rateLimitPerMin);
      }
    }
    await this.usersRepo.save(user);
    return { updated: true };
  }

  // ===== Webhook HMAC foundation endpoints =====
  @Post('users/:id/webhook/secret/generate')
  async webhookGenerate(@Req() req: any, @Param('id') userId: string) {
    this.ensureOwner(req);
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
    if (!user) throw new Error('NOT_FOUND');
    if (user.apiWebhookSecret) throw new Error('ALREADY_EXISTS');
    const secret = generateWebhookSecret();
    user.apiWebhookSecret = secret;
    user.apiWebhookEnabled = false; // must enable via settings explicitly
    user.apiWebhookSigVersion = 'v1';
    user.apiWebhookLastRotatedAt = new Date();
    await this.usersRepo.save(user);
    return { secret, version: user.apiWebhookSigVersion };
  }

  @Post('users/:id/webhook/secret/rotate')
  async webhookRotate(@Req() req: any, @Param('id') userId: string) {
    this.ensureOwner(req);
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
    if (!user) throw new Error('NOT_FOUND');
    if (!user.apiWebhookSecret) throw new Error('NO_SECRET');
    const secret = generateWebhookSecret();
    user.apiWebhookSecret = secret;
    user.apiWebhookLastRotatedAt = new Date();
    await this.usersRepo.save(user);
    return { secret, rotatedAt: user.apiWebhookLastRotatedAt };
  }

  @Post('users/:id/webhook/secret/revoke')
  async webhookRevoke(@Req() req: any, @Param('id') userId: string) {
    this.ensureOwner(req);
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
    if (!user) throw new Error('NOT_FOUND');
    user.apiWebhookSecret = null;
    user.apiWebhookEnabled = false;
    await this.usersRepo.save(user);
    return { revoked: true };
  }

  @Patch('users/:id/webhook/settings')
  async webhookSettings(@Req() req: any, @Param('id') userId: string, @Body() body: { enabled?: boolean; url?: string | null; sigVersion?: string; }) {
    this.ensureOwner(req);
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
    if (!user) throw new Error('NOT_FOUND');
    if (body.url !== undefined) user.apiWebhookUrl = body.url || null;
    if (body.sigVersion) user.apiWebhookSigVersion = body.sigVersion; // only v1 for now
    if (body.enabled !== undefined) {
      // enforce only if secret + url
      user.apiWebhookEnabled = !!(body.enabled && user.apiWebhookSecret && user.apiWebhookUrl);
    }
    await this.usersRepo.save(user);
    return { updated: true, enabled: user.apiWebhookEnabled };
  }

  @Post('users/:id/webhook/sign-preview')
  async webhookSignPreview(
    @Req() req: any,
    @Param('id') userId: string,
    @Body() body: { method: string; path: string; json?: any }
  ) {
    this.ensureOwner(req);
    const user = await this.usersRepo.findOne({ where: { id: userId } as any });
    if (!user) throw new Error('NOT_FOUND');
    if (!user.apiWebhookSecret) throw new Error('NO_SECRET');
    const payload = body.json === undefined ? {} : body.json;
    const raw = JSON.stringify(payload);
    const ts = Math.floor(Date.now()/1000);
    const nonce = randomUUID();
    const hash = sha256Hex(Buffer.from(raw));
    const canonical = buildCanonicalStringV1(body.method || 'POST', body.path || '/', ts, nonce, hash);
    const sig = hmacSignV1(user.apiWebhookSecret, canonical);
    return {
      headers: {
        'X-Webhook-Signature-Version': user.apiWebhookSigVersion || 'v1',
        'X-Webhook-Timestamp': ts,
        'X-Webhook-Nonce': nonce,
        'X-Webhook-Signature': sig,
      },
      canonical,
      bodyHash: hash,
    };
  }

  // ===== Stats & Logs (read-only) =====
  @Get('stats/today')
  async statsToday(@Req() req: any) {
    this.ensureOwner(req);
    const owner = await this.usersRepo.findOne({ where: { id: req.user.id } as any });
    const tenantId = owner?.tenantId;
    if (!tenantId) return { total: 0, ok: 0 };
    const start = new Date(); start.setHours(0,0,0,0);
    const rows = await this.logsRepo.createQueryBuilder('l')
      .select('l.code','code')
      .addSelect('COUNT(*)','cnt')
      .where('l.tenantId = :t',{ t: tenantId })
      .andWhere('l.createdAt >= :s',{ s: start })
      .groupBy('l.code')
      .getRawMany();
    const data: any = { total: 0, ok: 0 };
    let total = 0; let ok = 0;
    for (const r of rows) {
      const code = Number(r.code);
      const cnt = Number(r.cnt);
      total += cnt;
      if (code === 0) ok += cnt; else data['code_'+code] = cnt;
    }
    data.total = total; data.ok = ok;
    return data;
  }

  @Get('stats/last7d')
  async statsLast7d(@Req() req: any) {
    this.ensureOwner(req);
    const owner = await this.usersRepo.findOne({ where: { id: req.user.id } as any });
    const tenantId = owner?.tenantId;
    if (!tenantId) return [];
    const today = new Date(); today.setHours(0,0,0,0);
    const from = new Date(today.getTime() - 6*24*3600*1000);
    const fromStr = from.toISOString().slice(0,10);
    const rows = await this.statsDailyRepo.createQueryBuilder('d')
      .where('d.tenantId = :t',{ t: tenantId })
      .andWhere('d.date >= :f',{ f: fromStr })
      .orderBy('d.date','ASC')
      .getMany();
    // fill missing days
    const map: Record<string, ClientApiStatsDaily> = {} as any;
    for (const r of rows) map[r.date] = r as any;
    const out: any[] = [];
    for (let i=6;i>=0;i--) {
      const d = new Date(today.getTime() - i*24*3600*1000).toISOString().slice(0,10);
      const r = map[d];
      out.push({
        date: d,
        total: r?.total || 0,
        ok: r?.ok || 0,
        code_120: r?.code_120 || 0,
        code_121: r?.code_121 || 0,
        code_122: r?.code_122 || 0,
        code_123: r?.code_123 || 0,
        code_100: r?.code_100 || 0,
        code_110: r?.code_110 || 0,
        code_429: (r as any)?.code_429 || 0,
      });
    }
    return out;
  }

  @Get('stats/top-errors')
  async statsTopErrors(@Req() req: any, @Query('limit') limit?: string) {
    this.ensureOwner(req);
    const owner = await this.usersRepo.findOne({ where: { id: req.user.id } as any });
    const tenantId = owner?.tenantId;
    if (!tenantId) return [];
    const lim = Math.min(Math.max(Number(limit)||5,1),20);
    const start = new Date(); start.setHours(0,0,0,0);
    const rows = await this.logsRepo.createQueryBuilder('l')
      .select('l.code','code')
      .addSelect('COUNT(*)','cnt')
      .where('l.tenantId = :t',{ t: tenantId })
      .andWhere('l.createdAt >= :s',{ s: start })
      .andWhere('l.code <> 0')
      .groupBy('l.code')
      .orderBy('COUNT(*)','DESC')
      .limit(lim)
      .getRawMany();
    return rows.map(r=>({ code: Number(r.code), count: Number(r.cnt) }));
  }

  @Get('logs/recent')
  async recentLogs(@Req() req: any, @Query('limit') limit?: string) {
    this.ensureOwner(req);
    const owner = await this.usersRepo.findOne({ where: { id: req.user.id } as any });
    const tenantId = owner?.tenantId;
    if (!tenantId) return [];
    const lim = Math.min(Math.max(Number(limit)||20,1),100);
    const rows = await this.logsRepo.createQueryBuilder('l')
      .where('l.tenantId = :t',{ t: tenantId })
      .orderBy('l.createdAt','DESC')
      .limit(lim)
      .getMany();
    return rows.map(r=>({ id: r.id, path: r.path, method: r.method, code: r.code, ip: r.ip, createdAt: r.createdAt }));
  }

  // ===== Product Metadata Management (hidden) =====
  @Get('products/:id/metadata')
  async getProductMetadata(@Req() req: any, @Param('id') productId: string) {
    this.ensureOwner(req);
    const product = await this.productsRepo.findOne({ where: { id: productId } as any });
    if (!product) throw new Error('NOT_FOUND');
    const meta = await this.productMetaRepo.findOne({ where: { productId } as any });
    return meta || { productId, qtyMode: 'null', qtyFixed: 1, qtyMin: null, qtyMax: null, qtyList: null, paramsSchema: [], updatedAt: null };
  }

  @Patch('products/:id/metadata')
  async updateProductMetadata(@Req() req: any, @Param('id') productId: string, @Body() body: any) {
    this.ensureOwner(req);
    const product = await this.productsRepo.findOne({ where: { id: productId } as any });
    if (!product) throw new Error('NOT_FOUND');
    let meta = await this.productMetaRepo.findOne({ where: { productId } as any });
    if (!meta) {
      meta = this.productMetaRepo.create({ productId });
    }
    // qty_mode logic
    const mode = body.qtyMode || body.qty_mode || meta.qtyMode || 'null';
    if (!['null','fixed','range','list'].includes(mode)) throw new Error('INVALID_MODE');
    meta.qtyMode = mode;
    if (mode === 'fixed') {
      meta.qtyFixed = Number(body.qtyFixed || body.qty_fixed || 1) || 1;
    }
    if (mode === 'range') {
      meta.qtyMin = Number(body.qtyMin || body.qty_min || 1) || 1;
      meta.qtyMax = Number(body.qtyMax || body.qty_max || meta.qtyMin) || meta.qtyMin;
      if (meta.qtyMin! > meta.qtyMax!) meta.qtyMax = meta.qtyMin;
    } else {
      meta.qtyMin = null; meta.qtyMax = null;
    }
    if (mode === 'list') {
      let list = body.qtyList || body.qty_list || [];
      if (!Array.isArray(list)) list = [];
      meta.qtyList = list.map((x: any) => String(x)).slice(0, 300);
    } else {
      meta.qtyList = null;
    }
    // params schema
    if (body.paramsSchema || body.params_schema) {
      let arr = body.paramsSchema || body.params_schema;
      if (!Array.isArray(arr)) arr = [];
      meta.paramsSchema = arr.filter((p: any) => p && typeof p.key === 'string').slice(0, 50);
    }
    meta.updatedAt = new Date();
    await this.productMetaRepo.save(meta);
    return { updated: true };
  }
}
