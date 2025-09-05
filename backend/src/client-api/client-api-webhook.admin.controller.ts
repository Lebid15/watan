import { Controller, Get, Post, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ClientApiWebhookOutbox } from './client-api-webhook-outbox.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
// Reuse existing tenant resolution via request object (fallback if decorator absent)

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiExcludeController()
@Controller('/api/tenant/client-api/webhooks')
export class ClientApiWebhookAdminController {
  constructor(
    @InjectRepository(ClientApiWebhookOutbox) private readonly outboxRepo: Repository<ClientApiWebhookOutbox>,
  ) {}

  @Get('outbox')
  async list(@Req() req: any, @Query('status') status?: string, @Query('limit') limitRaw?: string) {
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const limit = Math.min(Math.max(Number(limitRaw) || 50, 1), 100);
    const where: any = { tenantId };
    if (status) where.status = In(status.split(',').map(s=>s.trim()).filter(Boolean));
    const rows = await this.outboxRepo.find({ where, order: { created_at: 'DESC' }, take: limit });
    return rows.map(r=> ({
      id: r.id,
      status: r.status,
      attempt_count: r.attempt_count,
      next_attempt_at: r.next_attempt_at,
      last_error: r.last_error?.slice(0,200) || null,
      response_code: r.response_code || null,
      event_type: r.event_type,
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  }

  @Post('outbox/:id/retry')
  async retry(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const row = await this.outboxRepo.findOne({ where: { id, tenantId } as any });
    if (!row) return { ok: false, error: 'NOT_FOUND' };
    if (row.status === 'succeeded' || row.status === 'dead') {
      // allow retry even if succeeded (will just attempt again)
    }
    row.status = 'failed';
    row.next_attempt_at = new Date();
    await this.outboxRepo.save(row);
    return { ok: true };
  }

  @Post('outbox/:id/mark-dead')
  async markDead(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const row = await this.outboxRepo.findOne({ where: { id, tenantId } as any });
    if (!row) return { ok: false, error: 'NOT_FOUND' };
    row.status = 'dead';
    row.next_attempt_at = null;
    await this.outboxRepo.save(row);
    return { ok: true };
  }

  @Post('outbox/:id/redeliver')
  async redeliver(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const row = await this.outboxRepo.findOne({ where: { id, tenantId } as any });
    if (!row) return { ok: false, error: 'NOT_FOUND' };
    // duplicate row with same event_id (payload holds event_id) but reset attempts
    const clone = this.outboxRepo.create({
      tenantId: row.tenantId,
      userId: row.userId,
      event_type: row.event_type,
      delivery_url: row.delivery_url,
      payload_json: row.payload_json,
      status: 'pending',
      attempt_count: 0,
      next_attempt_at: new Date(),
    });
    await this.outboxRepo.save(clone);
    return { ok: true, new_id: clone.id };
  }

  @Get('outbox/stats')
  async stats(@Req() req: any) {
    const tenantId = req.tenant?.id || req.user?.tenantId;
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    const sevenDaysAgo = new Date(Date.now() - 6*24*3600*1000); // include today

    // Aggregate overall counts
    const allRows = await this.outboxRepo.find({ where: { tenantId } as any });
    const statuses: Record<string, number> = { pending:0, delivering:0, failed:0, dead:0, succeeded:0 };
    for (const r of allRows) { statuses[r.status] = (statuses[r.status]||0)+1; }

    // Today succeeded count
    let succeededToday = 0;
    for (const r of allRows) if (r.status === 'succeeded' && r.created_at >= startOfToday) succeededToday++;

    // Last 7d daily buckets
    const days: { date: string; pending: number; failed: number; dead: number; succeeded: number; delivering: number }[] = [];
    for (let i=6;i>=0;i--) {
      const d = new Date(startOfToday.getTime() - i*24*3600*1000);
      const key = d.toISOString().slice(0,10);
      days.push({ date: key, pending:0, failed:0, dead:0, succeeded:0, delivering:0 });
    }
    const dayIndex = new Map(days.map((d,i)=>[d.date,i]));
    for (const r of allRows) {
      if (r.created_at < sevenDaysAgo) continue;
      const key = r.created_at.toISOString().slice(0,10);
      const idx = dayIndex.get(key); if (idx==null) continue;
      (days[idx] as any)[r.status]++;
    }

    return { ...statuses, succeededToday, last7d: days };
  }
}
