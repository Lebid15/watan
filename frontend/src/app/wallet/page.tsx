// src/app/wallet/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fmtDateStable } from '@/lib/fmtDateStable';
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
const fileUrl = (u?: string | null) => (!u ? '' : u.startsWith('/uploads') ? `${FILES_BASE}${u}` : u);

const fmt = (v: number | string | undefined | null, maxFrac = 2) => {
  const n = Number(v);
  if (!isFinite(n)) return '—';
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });
};

const fmtDate = (d: string) => fmtDateStable(d);

export default function WalletPage() {
  useAuthRequired();
  const { t } = useTranslation();

  const [rows, setRows] = useState<MyDeposit[]>([]);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'user_request' | 'admin_topup'>('all');
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState<boolean>(false);

  const depositEndpoints = useMemo(() => {
    const depositsRoutes = API_ROUTES.payments.deposits as typeof API_ROUTES.payments.deposits & {
      legacyMine?: string | null;
    };
    return [depositsRoutes.mine, depositsRoutes.legacyMine]
      .filter((u): u is string => typeof u === 'string' && !!u);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchFirst = async () => {
      setLoadingFirst(true);
      setErr('');
      setOpenId(null);

      let lastError: ErrorResponse | null = null;

      try {
        for (const url of depositEndpoints) {
          try {
            const { data } = await api.get<WalletPageResponse>(url, {
              params: {
                limit: PAGE_LIMIT,
                source: sourceFilter === 'all' ? undefined : sourceFilter,
              },
            });

            if (cancelled) return;

            if (Array.isArray(data)) {
              setRows(data);
              setNextCursor(null);
              setHasMore(false);
            } else {
              const items = data.items ?? [];
              const page: PageInfo = data.pageInfo ?? {};
              setRows(items);
              setNextCursor(page.nextCursor ?? null);
              setHasMore(Boolean(page.hasMore));
            }
            return;
          } catch (error) {
            lastError = error as ErrorResponse;
            const status = lastError?.response?.status;
            if (status === 404) {
              continue;
            }
            break;
          }
        }

        if (!cancelled) {
          const msg =
            lastError?.response?.data?.message ||
            lastError?.message ||
            t('wallet.fetch.fail');
          setErr(Array.isArray(msg) ? msg.join(', ') : msg);
          setRows([]);
          if (lastError) {
            console.error('Wallet deposits fetch error:', lastError);
          }
        }
      } finally {
        if (!cancelled) setLoadingFirst(false);
      }
    };

    fetchFirst();
    return () => {
      cancelled = true;
    };
  }, [depositEndpoints, sourceFilter, t]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    setErr('');

    let lastError: ErrorResponse | null = null;

    try {
      for (const url of depositEndpoints) {
        try {
          const { data } = await api.get<WalletPageResponse>(url, {
            params: {
              limit: PAGE_LIMIT,
              cursor: nextCursor ?? undefined,
              source: sourceFilter === 'all' ? undefined : sourceFilter,
            },
          });

          if (Array.isArray(data)) {
            setHasMore(false);
            return;
          }

          const items = data.items ?? [];
          const page: PageInfo = data.pageInfo ?? {};
          setRows((prev) => [...prev, ...items]);
          setNextCursor(page.nextCursor ?? null);
          setHasMore(Boolean(page.hasMore));
          return;
        } catch (error) {
          lastError = error as ErrorResponse;
          const status = lastError?.response?.status;
          if (status === 404) {
            continue;
          }
          break;
        }
      }

      const msg =
        lastError?.response?.data?.message ||
        lastError?.message ||
        t('wallet.fetch.moreFail');
      setErr(Array.isArray(msg) ? msg.join(', ') : msg);
      if (lastError) {
        console.error('Wallet deposits loadMore error:', lastError);
      }
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

  const orderedRows = useMemo(() => {
    const weight = (s: DepositStatus) => (s === 'pending' ? 0 : s === 'approved' ? 1 : 2);
    return [...rows].sort((a, b) => {
      const dw = weight(a.status) - weight(b.status);
      if (dw !== 0) return dw;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [rows]);

  const hasPendingDeposit = useMemo(
    () => rows.some((deposit) => deposit.status === 'pending'),
    [rows]
  );

  const filters = [
    { key: 'all' as const, label: 'الكل' },
    { key: 'user_request' as const, label: 'طلبات المستخدم' },
    { key: 'admin_topup' as const, label: 'شحن إداري' },
  ];

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto bg-bg-base text-text-primary" dir="rtl">
      <style>{`
        .pending-deposit-card {
          background-color: #584402ff;
          border: 1px solid #F7C15A;
        }
        .pending-deposit-card .pending-deposit-trigger {
          background-color: transparent;
        }
        .pending-deposit-card .pending-deposit-trigger:hover {
          background-color: rgba(255, 209, 102, 0.18);
        }
        .pending-deposit-card .pending-deposit-details {
          background-color: rgba(255, 233, 160, 0.08);
        }
      `}</style>

      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-lg font-bold mb-1">{t('wallet.pageTitle')}</h1>
        </div>
        {hasPendingDeposit ? (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              className="btn btn-primary text-sm px-4 py-2 whitespace-nowrap opacity-60 cursor-not-allowed"
              disabled
            >
              إضافة رصيد
            </button>
            <span className="text-xs text-warning">
              لديك طلب إيداع قيد المعالجة. انتظر الموافقة قبل إرسال طلب جديد.
            </span>
          </div>
        ) : (
          <Link
            href="/payments/deposits"
            className="btn btn-primary text-sm px-4 py-2 whitespace-nowrap"
          >
            إضافة رصيد
          </Link>
        )}
      </div>

      {err && <div className="mb-3 text-danger">{err}</div>}

      <div className="flex items-center gap-2 mb-4">
        {filters.map((tab) => {
          const active = sourceFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSourceFilter(tab.key)}
              className={[
                'px-3 py-1 rounded-full text-xs font-medium border transition',
                active
                  ? 'bg-primary text-[rgb(var(--color-primary-contrast))] border-primary'
                  : 'bg-bg-surface-alt border-border text-text-secondary hover:text-text-primary',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loadingFirst ? (
        <div className="text-text-secondary">{t('wallet.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="text-text-secondary">{t('wallet.empty')}</div>
      ) : (
        <>
          <div className="space-y-3">
            {orderedRows.map((r) => {
              const isOpen = openId === r.id;
              const pending = r.status === 'pending';
              return (
                <div
                  key={r.id}
                  className={[
                    'card rounded-2xl overflow-hidden ring-1',
                    ringByStatus(r.status),
                    pending ? 'pending-deposit-card' : '',
                  ].join(' ')}
                >
                  <button
                    onClick={() => setOpenId(isOpen ? null : r.id)}
                    className={[
                      'w-full px-4 py-3 space-y-1 bg-bg-surface-alt hover:bg-bg-surface transition text-right',
                      pending ? 'pending-deposit-trigger' : '',
                    ].join(' ')}
                  >
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
                          {r.method?.name || t('wallet.deposit.method.fallback')}
                          {r.source && (
                            <span
                              className={[
                                'text-[10px] px-2 py-0.5 rounded-full border',
                                r.source === 'admin_topup'
                                  ? 'bg-success/10 border-success/40 text-success'
                                  : 'bg-primary/10 border-primary/30 text-primary',
                              ].join(' ')}
                            >
                              {r.source === 'admin_topup'
                                ? t('wallet.deposit.source.admin_topup')
                                : t('wallet.deposit.source.user_request')}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="text-sm text-text-primary font-medium">
                        {fmt(r.convertedAmount)} {r.walletCurrency}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">{fmtDate(r.createdAt)}</span>
                      <span className={pillClass(r.status)}>{t(`wallet.deposit.status.${r.status}`)}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div
                      className={[
                        'px-4 pb-4 bg-bg-surface',
                        pending ? 'pending-deposit-details' : '',
                      ].join(' ')}
                    >
                      <div className="grid sm:grid-cols-2 gap-3 text-sm">
                        <div className="bg-bg-surface-alt rounded-lg p-3">
                          <div className="text-text-secondary">{t('wallet.deposit.originalAmount')}</div>
                          <div className="font-medium text-text-primary">
                            {fmt(r.originalAmount)} {r.originalCurrency}
                          </div>
                        </div>
                        <div className="bg-bg-surface-alt rounded-lg p-3">
                          <div className="text-text-secondary">{t('wallet.deposit.convertedAmount')}</div>
                          <div className="font-medium text-text-primary">
                            {fmt(r.convertedAmount)} {r.walletCurrency}
                          </div>
                        </div>
                        <div className="bg-bg-surface-alt rounded-lg p-3">
                          <div className="text-text-secondary">{t('wallet.deposit.rateUsed')}</div>
                          <div className="font-medium text-text-primary">{fmt(r.rateUsed, 6)}</div>
                        </div>
                        <div className="bg-bg-surface-alt rounded-lg p-3">
                          <div className="text-text-secondary">{t('wallet.deposit.operationId')}</div>
                          <div className="font-medium text-text-primary">#{r.id.slice(0, 8)}</div>
                        </div>
                        {r.note && (
                          <div className="bg-bg-surface-alt rounded-lg p-3 sm:col-span-2">
                            <div className="text-text-secondary mb-1">{t('wallet.deposit.note')}</div>
                            <div className="font-medium text-text-primary">{r.note}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center justify-center">
            {hasMore ? (
              <button onClick={loadMore} disabled={loadingMore} className="btn btn-primary text-xs disabled:opacity-60">
                {loadingMore ? t('wallet.loading') : t('wallet.loadMore')}
              </button>
            ) : (
              <div className="py-2 text-xs text-text-secondary">{t('wallet.noMore')}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
