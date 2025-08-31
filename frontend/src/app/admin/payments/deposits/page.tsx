'use client';

import { useEffect, useMemo, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import { ErrorResponse } from '@/types/common';

type DepositStatus = 'pending' | 'approved' | 'rejected';

interface DepositRow {
  id: string;
  user?: { id: string; email?: string; fullName?: string; username?: string } | null;
  method?: { id: string; name: string; type?: string } | null;

  originalAmount: number | string;
  originalCurrency: string;

  rateUsed: number | string;
  convertedAmount: number | string;
  walletCurrency: string;

  note?: string | null;
  status: DepositStatus;
  createdAt: string;
}

interface DepositsResponse {
  items: Record<string, unknown>[];
  pageInfo: { nextCursor: string | null; hasMore: boolean };
  meta?: { limit?: number; appliedFilters?: Record<string, string> };
}

const statusTabs: { key: DepositStatus | 'all'; label: string }[] = [
  { key: 'all',      label: 'الكل' },
  { key: 'pending',  label: 'قيد المراجعة' },
  { key: 'approved', label: 'مقبول' },
  { key: 'rejected', label: 'مرفوض' },
];

const fmt = (v: number | string | undefined | null, maxFrac = 2) => {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: maxFrac });
};

// يلتقط أول قيمة موجودة
const first = <T = unknown>(obj: Record<string, unknown>, ...keys: string[]): T | undefined => {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
};

function normalizeRow(x: Record<string, unknown>): DepositRow {
  const userRaw   = first<Record<string, unknown>>(x, 'user', 'account') ?? null;
  const methodRaw = first<Record<string, unknown>>(x, 'method', 'paymentMethod', 'payment_method') ?? null;

  const originalAmount =
    first<number | string>(x, 'originalAmount', 'original_amount', 'amount', 'origAmount', 'value') ?? 0;

  const originalCurrency =
    first<string>(x, 'originalCurrency', 'original_currency', 'currency', 'origCurrency', 'fromCurrency') ?? 'USD';

  const rateUsed =
    first<number | string>(x, 'rateUsed', 'rate_used', 'fxRate', 'rate', 'usedRate') ?? 1;

  const walletCurrency =
    first<string>(x, 'walletCurrency', 'wallet_currency', 'creditCurrency', 'credit_currency', 'toCurrency') ??
    (userRaw ? first<string>(userRaw, 'currencyCode', 'currency', 'code') : null) ??
    'TRY';

  let convertedAmount =
    first<number | string>(x,
      'convertedAmount', 'converted_amount',
      'amountConverted', 'amount_converted',
      'amount_wallet', 'creditAmount', 'credit_amount'
    );

  if (convertedAmount == null) {
    const oa = Number(originalAmount);
    const r  = Number(rateUsed);
    convertedAmount = (isFinite(oa) && isFinite(r)) ? oa * r : 0;
  }

  const createdAtRaw = first<string | Date>(x, 'createdAt', 'created_at') ?? new Date().toISOString();
  const statusRaw = String(first<string>(x, 'status', 'state') ?? 'pending').toLowerCase();
  const status: DepositStatus = statusRaw === 'approved' ? 'approved' : statusRaw === 'rejected' ? 'rejected' : 'pending';

  const user = userRaw
    ? {
        id: first<string>(userRaw, 'id') ?? '',
        email: first<string>(userRaw, 'email'),
        fullName: first<string>(userRaw, 'fullName', 'name'),
        username: first<string>(userRaw, 'username'),
      }
    : null;

  const method = methodRaw
    ? {
        id: first<string>(methodRaw, 'id') ?? '',
        name: first<string>(methodRaw, 'name', 'title') ?? '—',
        type: first<string>(methodRaw, 'type'),
      }
    : null;

  return {
    id: String(first<string>(x, 'id', 'depositId', 'deposit_id') ?? ''),
    user,
    method,
    originalAmount,
    originalCurrency,
    rateUsed,
    convertedAmount,
    walletCurrency,
    note: first<string>(x, 'note', 'remark') ?? null,
    status,
    createdAt: typeof createdAtRaw === 'string' ? createdAtRaw : new Date(createdAtRaw).toISOString(),
  };
}

export default function AdminDepositsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DepositRow[]>([]);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<DepositStatus | 'all'>('all');

  // باجينيشن
  const PAGE_SIZE = 25;
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // حالة تحميل للعملية على مستوى السطر
  const [actionRowId, setActionRowId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return rows;
    return rows.filter(r => r.status === activeTab);
  }, [rows, activeTab]);

  const buildUrl = (params: Record<string, string>) =>
    `${API_ROUTES.admin.deposits.base}?${new URLSearchParams(params).toString()}`;

  const buildSetStatusUrl = (id: string) => {
    const adminRoutes = (API_ROUTES as Record<string, unknown>)?.admin as Record<string, unknown> | undefined;
    const depositsRoutes = adminRoutes?.deposits as Record<string, unknown> | undefined;
    const fn = depositsRoutes?.setStatus;
    return typeof fn === 'function'
      ? fn(id)
      : `${(API_ROUTES as { admin: { deposits: { base: string } } }).admin.deposits.base}/${id}/status`;
  };

  const fetchPage = async (reset = false) => {
    try {
      if (reset) { setLoading(true); setNextCursor(null); } else { setLoadingMore(true); }
      setError('');

      const params: Record<string, string> = { limit: String(PAGE_SIZE) };
      if (!reset && nextCursor) params.cursor = nextCursor;
      if (activeTab !== 'all') params.status = String(activeTab);

      const url = buildUrl(params);
      const { data } = await api.get<DepositsResponse>(url);

      const incoming = Array.isArray(data?.items) ? data.items : [];
      const normalized = incoming.map(normalizeRow);

      setRows(prev => (reset ? normalized : [...prev, ...normalized]));
      setNextCursor(data?.pageInfo?.nextCursor ?? null);
      setHasMore(!!data?.pageInfo?.hasMore);
    } catch (e: unknown) {
      const error = e as ErrorResponse;
      const msg = error?.response?.data?.message || error?.message || 'تعذّر جلب الإيداعات';
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
      if (reset) setRows([]);
    } finally {
      if (reset) setLoading(false); else setLoadingMore(false);
    }
  };

  useEffect(() => { fetchPage(true); }, [fetchPage]);
  useEffect(() => { fetchPage(true); }, [activeTab, fetchPage]);

  const setStatus = async (row: DepositRow, status: DepositStatus) => {
    const verb =
      status === 'approved' ? 'قبول'
      : status === 'rejected' ? 'إبطال'
      : 'تحديث';

    if (!confirm(`تأكيد ${verb} طلب الإيداع؟`)) return;

    const url = buildSetStatusUrl(row.id);
    const payload = { status };

    try {
      setActionRowId(row.id);
      setError('');
      await api.patch(url, payload, { timeout: 15000 });

      setRows(prev => prev.map(it => it.id === row.id ? { ...it, status } : it));

      await fetchPage(true);
    } catch (e: unknown) {
      const error = e as ErrorResponse;
      console.error('[ADMIN][DEPOSITS] setStatus error:', error);
      const msg = error?.response?.data?.message || error?.message || `تعذّر ${verb} الإيداع`;
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setActionRowId(null);
    }
  };

  return (
    <div className="bg-bg-base text-text-primary p-6 min-h-screen">
      <section className="rounded-lg border border-border bg-bg-surface p-4">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold">طلبات الإيداع</h2>

        <div className="flex items-center gap-2">
            {statusTabs.map(t => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1 rounded text-sm border transition
                    ${isActive
                      ? 'bg-primary text-primary-contrast border-border'
                      : 'bg-bg-surface-alt text-text-primary border-border hover:opacity-90'
                    }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-3 text-sm text-danger border border-danger/30 rounded p-2 bg-danger/10">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-text-secondary">جارِ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="text-text-secondary">لا توجد سجلات.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-full text-sm bg-bg-surface">
              <thead>
                <tr className="bg-bg-surface-alt text-center">
                  <th className="border border-border px-3 py-2">المستخدم</th>
                  <th className="border border-border px-3 py-2">الوسيلة</th>
                  <th className="border border-border px-3 py-2">المبلغ الأصلي</th>
                  <th className="border border-border px-3 py-2">سعر الصرف</th>
                  <th className="border border-border px-3 py-2">المبلغ بعد التحويل</th>
                  <th className="border border-border px-3 py-2">الحالة</th>
                  <th className="border border-border px-3 py-2">التاريخ</th>
                  <th className="border border-border px-3 py-2">إجراءات</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => {
                  const userLabel =
                    r.user?.username ||
                    r.user?.email ||
                    r.user?.fullName ||
                    (r.user?.id ? `#${r.user.id.slice(0, 6)}` : '—');

                  const methodLabel = r.method?.name || '—';

                  const original  = `${fmt(r.originalAmount)} ${r.originalCurrency}`;
                  const rate      = fmt(r.rateUsed, 6);
                  const converted = `${fmt(r.convertedAmount)} ${r.walletCurrency}`;

                  const busy = actionRowId === r.id;

                  return (
                    <tr key={r.id} className="text-center hover:bg-bg-surface-alt">
                      <td className="border border-border px-3 py-2">{userLabel}</td>
                      <td className="border border-border px-3 py-2">{methodLabel}</td>
                      <td className="border border-border px-3 py-2">{original}</td>
                      <td className="border border-border px-3 py-2">{rate}</td>
                      <td className="border border-border px-3 py-2">{converted}</td>
                      <td className="border border-border px-3 py-2">
                        <span
                          className={`inline-block w-4 h-4 rounded-full
                            ${r.status === 'approved'
                              ? 'bg-success'
                              : r.status === 'rejected'
                              ? 'bg-danger'
                              : 'bg-warning'}`}
                          title={r.status}
                        />
                      </td>
                      <td className="border border-border px-3 py-2">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      <td className="border border-border px-3 py-2">
                        {r.status === 'pending' ? (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setStatus(r, 'approved')}
                              disabled={busy}
                              className="px-3 py-1 rounded bg-success text-text-inverse hover:brightness-110 disabled:opacity-50"
                            >
                              {busy ? 'جارِ التنفيذ…' : 'قبول'}
                            </button>
                            <button
                              onClick={() => setStatus(r, 'rejected')}
                              disabled={busy}
                              className="px-3 py-1 rounded bg-danger text-text-inverse hover:brightness-110 disabled:opacity-50"
                            >
                              {busy ? 'جارِ التنفيذ…' : 'رفض'}
                            </button>
                          </div>
                        ) : r.status === 'approved' ? (
                          <button
                            onClick={() => setStatus(r, 'rejected')}
                            disabled={busy}
                            className="px-3 py-1 rounded bg-danger text-text-inverse hover:brightness-110 disabled:opacity-50"
                          >
                            {busy ? 'جارِ التنفيذ…' : 'إبطال'}
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatus(r, 'approved')}
                            disabled={busy}
                            className="px-3 py-1 rounded bg-success text-text-inverse hover:brightness-110 disabled:opacity-50"
                          >
                            {busy ? 'جارِ التنفيذ…' : 'قبول'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {hasMore && (
              <div className="flex justify-center p-3 border-t border-border bg-bg-surface">
                <button
                  onClick={() => fetchPage(false)}
                  disabled={loadingMore}
                  className="px-4 py-2 rounded bg-bg-surface-alt border border-border hover:opacity-90 disabled:opacity-50"
                >
                  {loadingMore ? 'جارِ التحميل…' : 'تحميل المزيد'}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
