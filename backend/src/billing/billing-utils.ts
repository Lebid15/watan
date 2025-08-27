// Phase5 Billing utilities (UTC only)
// All period date strings in form YYYY-MM-DD (UTC).
export function pad(n: number): string { return n < 10 ? '0' + n : '' + n; }
export function toIsoDate(d: Date): string { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

export function getEom(dateUTC: Date): Date {
  const y = dateUTC.getUTCFullYear();
  const m = dateUTC.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, 0));
}

export function nextEom(dateUTC: Date): Date {
  const y = dateUTC.getUTCFullYear();
  const m = dateUTC.getUTCMonth();
  return new Date(Date.UTC(y, m + 2, 0));
}

export function isFirstMonthFree(tenantCreatedAt: Date, periodStart: string, periodEnd: string): boolean {
  const created = tenantCreatedAt;
  const ps = new Date(periodStart + 'T00:00:00Z');
  const pe = new Date(periodEnd + 'T23:59:59Z');
  return created >= ps && created <= pe;
}

export function computeDueAt(issuedAt: Date, graceDays: number): Date {
  return new Date(issuedAt.getTime() + graceDays * 24 * 60 * 60 * 1000);
}

export function computeNextDueAt(nextIssuedAt: Date, graceDays: number): Date {
  return computeDueAt(nextIssuedAt, graceDays);
}

export function buildMonthlyPeriod(dateUTC: Date): { periodStart: string; periodEnd: string } {
  const start = new Date(Date.UTC(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), 1));
  const end = getEom(dateUTC);
  return { periodStart: toIsoDate(start), periodEnd: toIsoDate(end) };
}

export function issuanceTimestampEom(periodEnd: string): Date {
  const [y, m, d] = periodEnd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 23, 55, 0, 0));
}

export function nextIssuanceTimestampAfter(periodEnd: string): Date {
  const [y, m] = periodEnd.split('-').map(Number);
  const firstNext = new Date(Date.UTC(y, m, 1));
  const nextPeriodEnd = getEom(firstNext);
  return issuanceTimestampEom(toIsoDate(nextPeriodEnd));
}

export function computePeriodAndIssuance(nowUTC: Date) {
  const { periodStart, periodEnd } = buildMonthlyPeriod(nowUTC);
  const issuedAt = issuanceTimestampEom(periodEnd);
  return { periodStart, periodEnd, issuedAt };
}