'use client';

import { useMemo, useState, useEffect } from 'react';
import { MOCK_DEPOSITS, type DepositStatus } from '@/data/mockDeposits';
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';

const fmt = (v: number, maxFrac = 2) => {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });
};

const fmtDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function WalletPage() {
  const { t, i18n } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<'all' | 'user_request' | 'admin_topup'>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  const activeLocale = i18n.language || i18n.resolvedLanguage || 'ar';

  useEffect(() => {
    let mounted = true;
    setNamespaceReady(false);
    (async () => {
      try {
        await loadNamespace(activeLocale, 'common');
      } catch {}
      if (mounted) setNamespaceReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [activeLocale]);

  const fmtDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleString(activeLocale === 'ar' ? 'ar-EG' : activeLocale === 'tr' ? 'tr-TR' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pillClass = (s: DepositStatus) =>
    [
      'inline-flex items-center rounded-full px-2 py-1 text-xs',
      s === 'approved'
        ? 'bg-green-500 text-white'
        : s === 'rejected'
        ? 'bg-red-500 text-white'
        : 'bg-yellow-500 text-white',
    ].join(' ');

  const ringByStatus = (s: DepositStatus) =>
    s === 'approved'
      ? 'ring-green-500/30'
      : s === 'rejected'
      ? 'ring-red-500/30'
      : 'ring-yellow-500/30';

  const filteredRows = useMemo(() => {
    const filtered = sourceFilter === 'all' 
      ? MOCK_DEPOSITS 
      : MOCK_DEPOSITS.filter((d) => d.source === sourceFilter);
    
    // ترتيب: pending أولاً، ثم حسب التاريخ
    return filtered.sort((a, b) => {
      const weight = (s: DepositStatus) => (s === 'pending' ? 0 : s === 'approved' ? 1 : 2);
      const dw = weight(a.status) - weight(b.status);
      if (dw !== 0) return dw;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [sourceFilter]);

  const hasPendingDeposit = useMemo(
    () => MOCK_DEPOSITS.some((deposit) => deposit.status === 'pending'),
    []
  );

  const filters = [
    { key: 'all' as const, label: t('wallet.filter.all') },
    { key: 'user_request' as const, label: t('wallet.filter.user_request') },
    { key: 'admin_topup' as const, label: t('wallet.filter.admin_topup') },
  ];

  if (!namespaceReady) {
    return <div className="min-h-screen p-4 max-w-2xl mx-auto bg-bg-base text-text-primary" dir="rtl">
      <p className="text-center mt-6">{t('common.loading')}</p>
    </div>;
  }

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

      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl mb-1">{t('wallet.title')}</h1>
        </div>
        {hasPendingDeposit ? (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-primary/50 text-white text-sm cursor-not-allowed"
              disabled
            >
              {t('wallet.addBalanceDisabled')}
            </button>
            <span className="text-xs text-yellow-500">
              {t('wallet.pendingDepositWarning')}
            </span>
          </div>
        ) : (
          <button className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:bg-primary/90 transition-all">
            {t('wallet.addBalance')}
          </button>
        )}
      </div>

      {/* الفلاتر */}
      <div className="flex items-center gap-2 mb-4">
        {filters.map((tab) => {
          const active = sourceFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSourceFilter(tab.key)}
              className={`px-3 py-1 rounded-full text-xs border transition-all ${
                active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-bg-surface border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* القائمة */}
      {!filteredRows || filteredRows.length === 0 ? (
        <div className="text-center text-text-secondary py-12">{t('wallet.noDeposits')}</div>
      ) : (
        <div className="space-y-3">
          {filteredRows.map((r) => {
            const isOpen = openId === r.id;
            const pending = r.status === 'pending';
            return (
              <div
                key={r.id}
                className={`rounded-2xl overflow-hidden ring-1 ${ringByStatus(r.status)} ${
                  pending ? 'pending-deposit-card' : ''
                }`}
              >
                <button
                  onClick={() => setOpenId(isOpen ? null : r.id)}
                  className={`w-full px-4 py-3 space-y-1 bg-bg-surface-alt hover:bg-bg-surface transition text-right ${
                    pending ? 'pending-deposit-trigger' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-bg-surface border border-border grid place-items-center text-text-secondary">
                        💳
                      </div>
                      <span className="text-text-primary flex items-center gap-2">
                        {r.method.name}
                        {r.source && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full border ${
                              r.source === 'admin_topup'
                                ? 'bg-green-500/10 border-green-500/40 text-green-500'
                                : 'bg-primary/10 border-primary/30 text-primary'
                            }`}
                          >
                            {r.source === 'admin_topup' ? t('wallet.deposit.source.admin_topup') : t('wallet.deposit.source.user_request')}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="text-sm text-text-primary">
                      {fmt(r.convertedAmount)} {r.walletCurrency}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary" suppressHydrationWarning>{fmtDate(r.createdAt)}</span>
                    <span className={pillClass(r.status)}>
                      {r.status === 'approved' ? t('wallet.deposit.status.approved') : r.status === 'rejected' ? t('wallet.deposit.status.rejected') : t('wallet.deposit.status.pending')}
                    </span>
                  </div>
                </button>

                {isOpen && (
                  <div
                    className={`px-4 pb-4 bg-bg-surface ${
                      pending ? 'pending-deposit-details' : ''
                    }`}
                  >
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div className="bg-bg-surface-alt rounded-lg p-3">
                        <div className="text-text-secondary">{t('wallet.originalAmountLabel')}</div>
                        <div className="text-text-primary">
                          {fmt(r.originalAmount)} {r.originalCurrency}
                        </div>
                      </div>
                      <div className="bg-bg-surface-alt rounded-lg p-3">
                        <div className="text-text-secondary">{t('wallet.convertedAmountLabel')}</div>
                        <div className="text-text-primary">
                          {fmt(r.convertedAmount)} {r.walletCurrency}
                        </div>
                      </div>
                      <div className="bg-bg-surface-alt rounded-lg p-3">
                        <div className="text-text-secondary">{t('wallet.rateUsedLabel')}</div>
                        <div className="text-text-primary">{fmt(r.rateUsed, 6)}</div>
                      </div>
                      <div className="bg-bg-surface-alt rounded-lg p-3">
                        <div className="text-text-secondary">{t('wallet.operationIdLabel')}</div>
                        <div className="text-text-primary">#{r.id.slice(0, 8)}</div>
                      </div>
                      {r.note && (
                        <div className="bg-bg-surface-alt rounded-lg p-3 sm:col-span-2">
                          <div className="text-text-secondary mb-1">{t('wallet.noteLabel')}</div>
                          <div className="text-text-primary">{r.note}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
