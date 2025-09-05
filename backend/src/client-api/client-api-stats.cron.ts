import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { ClientApiRequestLog } from './client-api-request-log.entity';
import { ClientApiStatsDaily } from './client-api-stats-daily.entity';

// Lightweight manual cron (setInterval). In future could use @nestjs/schedule.
@Injectable()
export class ClientApiStatsCron implements OnModuleInit {
  private logger = new Logger('ClientApiStatsCron');
  private started = false;
  constructor(
    @InjectRepository(ClientApiRequestLog) private logsRepo: Repository<ClientApiRequestLog>,
    @InjectRepository(ClientApiStatsDaily) private dailyRepo: Repository<ClientApiStatsDaily>,
  ) {}

  onModuleInit() {
    if (process.env.CLIENT_API_STATS_DISABLED === '1') return; // opt-out
    if (this.started) return;
    this.started = true;
    // Run at 00:05 server time daily; check every 60s.
    setInterval(() => this.maybeRun(), 60_000);
  }

  private lastRunDate: string | null = null;

  private async maybeRun() {
    const now = new Date();
    const hh = now.getHours();
    const mm = now.getMinutes();
    const dateStr = now.toISOString().slice(0,10);
    if (hh === 0 && mm >=5 && mm < 10) {
      if (this.lastRunDate === dateStr) return; // already ran today
      try {
        await this.aggregateYesterday();
        this.lastRunDate = dateStr;
      } catch (e:any) {
        this.logger.warn('Aggregation failed: ' + (e?.message || e));
      }
    }
  }

  private async aggregateYesterday() {
    const today = new Date();
    const y = new Date(today.getTime() - 24*3600*1000);
    const dayStr = y.toISOString().slice(0,10); // YYYY-MM-DD for previous day
    const start = new Date(dayStr + 'T00:00:00Z');
    const end = new Date(dayStr + 'T23:59:59.999Z');

    const logs = await this.logsRepo.createQueryBuilder('l')
      .select(['l.tenantId as tenantId','l.code as code'])
      .where('l.createdAt BETWEEN :s AND :e', { s: start, e: end })
      .getRawMany();
    if (!logs.length) { this.logger.log('No logs for ' + dayStr); return; }

    const byTenant: Record<string, number[]> = {};
    for (const row of logs) {
      const t = row.tenantid || row.tenantId; // pg lowercase
      const code = Number(row.code) || 0;
      if (!byTenant[t]) byTenant[t] = [];
      byTenant[t].push(code);
    }

    for (const [tenantId, codes] of Object.entries(byTenant)) {
      const stats: any = {
        tenantId,
        date: dayStr,
        total: codes.length,
        ok: codes.filter(c => c === 0).length,
        err_1xx: codes.filter(c => c >= 100 && c < 200).length,
        err_5xx: codes.filter(c => c >= 500).length,
      };
  const interesting = [100,105,106,109,110,112,113,114,120,121,122,123,130,429];
      for (const c of interesting) stats['code_'+c] = codes.filter(x => x === c).length;
      // UPSERT (PG specific ON CONFLICT)
      await this.dailyRepo.query(`INSERT INTO client_api_stats_daily ("tenantId","date","total","ok","err_1xx","err_5xx",${interesting.map(c=>`"code_${c}"`).join(',')}) VALUES ($1,$2,$3,$4,$5,$6,${interesting.map((_,i)=>'$'+(7+i)).join(',')}) ON CONFLICT ("tenantId","date") DO UPDATE SET "total"=EXCLUDED."total","ok"=EXCLUDED."ok","err_1xx"=EXCLUDED."err_1xx","err_5xx"=EXCLUDED."err_5xx",${interesting.map(c=>`"code_${c}"=EXCLUDED."code_${c}"`).join(',')}`,[tenantId, dayStr, stats.total, stats.ok, stats.err_1xx, stats.err_5xx, ...interesting.map(c=>stats['code_'+c]||0)]);
    }

    // Retention: keep 90 days
    await this.dailyRepo.query(`DELETE FROM client_api_stats_daily WHERE "date" < (CURRENT_DATE - INTERVAL '90 days')`);
    this.logger.log('Aggregated stats for ' + dayStr + ' tenants=' + Object.keys(byTenant).length);
  }
}
