// src/app/wallet/page.tsx
'use client';

import { useEffect, useState } from 'react';
import api, { API_ROUTES, API_BASE_URL } from '@/utils/api';
import { useAuthRequired } from '@/hooks/useAuthRequired';
import { ErrorResponse } from '@/types/common';

type DepositStatus = 'pending' | 'approved' | 'rejected';

interface MyDeposit {
  id: string;
  method?: { id: string; name: string; type: string; logoUrl?: string | null } | null;
  originalAmount: number | string;
  originalCurrency: string;
  walletCurrency: string;
  rateUsed: number | string;
  convertedAmount: number | string;
  note?: string | null;
  status: DepositStatus;
  createdAt: string;
  source?: 'user_request' | 'admin_topup';
  approvedAt?: string | null;
}

interface PageInfo {
  nextCursor?: string | null;
  hasMore?: boolean;
}
type WalletPageResponse =
  | MyDeposit[]
  | {
      items: MyDeposit[];
      pageInfo?: PageInfo;
      meta?: Record<string, unknown>;
    };

const PAGE_LIMIT = 20;

const FILES_BASE = API_BASE_URL.replace(/\/api$/, '');
const fileUrl = (u?: string | null) =>
  !u ? '' : u.startsWith('/uploads') ? `${FILES_BASE}${u}` : u;

const fmt = (v: number | string | undefined | null, maxFrac = 2) => {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });
};
const fmtDate = (d: string) => new Date(d).toLocaleString();

export default function WalletPage() {
  useAuthRequired();

  const [rows, setRows] = useState<MyDeposit[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'user_request' | 'admin_topup'>('all');
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  // pagination
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  // ===== جلب الدُفعة الأولى =====
  useEffect(() => {
    let cancelled = false;

    const fetchFirst = async () => {
      try {
        setLoadingFirst(true);
        setErr('');
        const { data } = await api.get<WalletPageResponse>(
          API_ROUTES.payments.deposits.mine,
          { params: { limit: PAGE_LIMIT, source: sourceFilter === 'all' ? undefined : sourceFilter } }
        );

        if (Array.isArray(data)) {
          if (!cancelled) {
            setRows(data);
            setNextCursor(null);
            setHasMore(false);
          }
        } else {
          const items = data.items ?? [];
          const page: PageInfo = data.pageInfo ?? {};
          if (!cancelled) {
            setRows(items);
            setNextCursor(page.nextCursor ?? null);
            setHasMore(Boolean(page.hasMore));
          }
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const error = e as ErrorResponse;
          const msg =
            error?.response?.data?.message || error?.message || 'تعذّر جلب الحركات';
          setErr(Array.isArray(msg) ? msg.join(', ') : msg);
          setRows([]);
        }
      } finally {
        if (!cancelled) setLoadingFirst(false);
      }
    };

    fetchFirst();
    return () => {
      cancelled = true;
    };
  }, [sourceFilter]);

  // ===== تحميل المزيد =====
  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      setErr('');
  const { data } = await api.get<WalletPageResponse>(
        API_ROUTES.payments.deposits.mine,
        {
          params: {
            limit: PAGE_LIMIT,
            cursor: nextCursor ?? undefined,
    source: sourceFilter === 'all' ? undefined : sourceFilter,
          },
        }
      );
      <div className="flex items-center gap-2 mb-4">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'user_request', label: 'طلبات المستخدم' },
          { key: 'admin_topup', label: 'شحن إداري' },
        ].map(tab => {
          const active = sourceFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSourceFilter(tab.key as any)}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium border transition',
                active
                  ? 'bg-primary text-[rgb(var(--color-primary-contrast))] border-primary'
                  : 'bg-bg-surface-alt border-border text-text-secondary hover:text-text-primary'
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      if (Array.isArray(data)) {
        // الباك يرجّع مصفوفة فقط → لا مزيد من الصفحات
        setHasMore(false);
        return;
      }

      const items = data.items ?? [];
      const page: PageInfo = data.pageInfo ?? {};
      setRows((prev) => [...prev, ...items]);
      setNextCursor(page.nextCursor ?? null);
      setHasMore(Boolean(page.hasMore));
    } catch (e: unknown) {
      const error = e as ErrorResponse;
      const msg =
        error?.response?.data?.message || error?.message || 'تعذّر تحميل المزيد';
      setErr(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoadingMore(false);
    }
  };

  const pillClass = (s: DepositStatus) =>
    [
      'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium',
      s === 'approved'
        ? 'bg-success text-[rgb(var(--color-primary-contrast))]'
        : s === 'rejected'
        ? 'bg-danger text-[rgb(var(--color-primary-contrast))]'
        : 'bg-warning text-[rgb(var(--color-primary-contrast))]',
    ].join(' ');

  const ringByStatus = (s: DepositStatus) =>
    s === 'approved'
      ? 'ring-success/30'
      : s === 'rejected'
      ? 'ring-danger/30'
      : 'ring-warning/30';

  return (
    <div
      className="min-h-screen p-4 max-w-2xl mx-auto bg-bg-base text-text-primary"
      dir="rtl"
    >
      <h1 className="text-xl font-bold mb-1">محفظتي</h1>
      <p className="mb-4 text-text-secondary">سجل حركات الإيداع.</p>

      {err && <div className="mb-3 text-danger">{err}</div>}

      {loadingFirst ? (
        <div className="text-text-secondary">جارِ التحميل...</div>
      ) : rows.length === 0 ? (
        <div className="text-text-secondary">لا توجد حركات بعد.</div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((r) => {
              const isOpen = openId === r.id;
              return (
                <div
                  key={r.id}
                  className={[
                    'card rounded-2xl overflow-hidden ring-1',
                    ringByStatus(r.status),
                  ].join(' ')}
                >
                  {/* Header (مختصر) */}
                  <button
                    onClick={() => setOpenId(isOpen ? null : r.id)}
                    className="w-full px-4 py-3 space-y-1 bg-bg-surface-alt hover:bg-bg-surface transition text-right"
                  >
                    {/* الصف الأول */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {r.method?.logoUrl ? (
                          <img
                            src={fileUrl(r.method.logoUrl)}
                            alt={r.method?.name || ''}
                            className="w-8 h-8 object-contain rounded bg-bg-surface border border-border"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-bg-surface border border-border grid place-items-center text-text-secondary">
                            —
                          </div>
                        )}
                        <span className="text-text-primary flex items-center gap-2">
                          {r.method?.name || 'وسيلة دفع'}
                          {r.source && (
                            <span
                              className={[
                                'text-[10px] px-2 py-0.5 rounded-full border',
                                r.source === 'admin_topup'
                                  ? 'bg-success/10 border-success/40 text-success'
                                  : 'bg-primary/10 border-primary/30 text-primary'
                              ].join(' ')}
                            >
                              {r.source === 'admin_topup' ? 'شحن إداري' : 'طلب مستخدم'}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-sm text-text-primary font-medium">
                        {fmt(r.convertedAmount)} {r.walletCurrency}
                      </div>
                    </div>

                    {/* الصف الثاني */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">
                        {fmtDate(r.createdAt)}
                      </span>
                      <span className={pillClass(r.status)}>
                        {r.status === 'approved'
                          ? 'مقبول'
                          : r.status === 'rejected'
                          ? 'مرفوض'
                          : 'قيد المراجعة'}
                      </span>
                    </div>
                  </button>

                  {/* Details */}
                  {isOpen && (
                    <div className="px-4 pb-4 bg-bg-surface">
                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        <div className="bg-bg-surface-alt rounded-lg p-3">
                          <div className="text-text-secondary">المبلغ الأصلي</div>
                          <div className="font-medium text-text-primary">
                            {fmt(r.originalAmount)} {r.originalCurrency}
                          </div>
                        </div>
                        <div className="bg-bg-surface-alt rounded-lg p-3">
                          <div className="text-text-secondary">المبلغ بعد التحويل</div>
                          <div className="font-medium text-text-primary">
                            {fmt(r.convertedAmount)} {r.walletCurrency}
                          </div>
                        </div>
                        <div className="bg-bg-surface-alt rounded-lg p-3">
                          <div className="text-text-secondary">سعر الصرف</div>
                          <div className="font-medium text-text-primary">
                            {fmt(r.rateUsed, 6)}
                          </div>
                        </div>
                        <div className="bg-bg-surface-alt rounded-lg p-3">
                          <div className="text-text-secondary">رقم العملية</div>
                          <div className="font-medium text-text-primary">
                            #{r.id.slice(0, 8)}
                          </div>
                        </div>
                        {r.note && (
                          <div className="bg-bg-surface-alt rounded-lg p-3 sm:col-span-2">
                            <div className="text-text-secondary mb-1">ملاحظة</div>
                            <div className="font-medium text-text-primary">
                              {r.note}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* زر تحميل المزيد */}
          <div className="mt-4 flex items-center justify-center">
            {hasMore ? (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="btn btn-primary text-xs disabled:opacity-60"
              >
                {loadingMore ? 'جارِ التحميل…' : 'تحميل المزيد'}
              </button>
            ) : (
              <div className="py-2 text-xs text-text-secondary">لا يوجد المزيد</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
