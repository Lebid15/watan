// src/app/payments/deposits/page.tsx  (عدّل المسار بحسب مشروعك)
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';
import { useAuthRequired } from '@/hooks/useAuthRequired';
import { ErrorResponse } from '@/types/common';
import { useTranslation } from 'react-i18next';

type PaymentMethodType = 'CASH_BOX' | 'BANK_ACCOUNT' | 'HAND_DELIVERY' | 'USDT' | 'MONEY_TRANSFER';

interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  logoUrl?: string | null;
  note?: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
}

type PaymentMethodApi = PaymentMethod & { logo_url?: string | null };

function resolveLogoUrl(raw: string | null | undefined, apiHost: string): string {
  if (!raw) return '/images/placeholder.png';
  const value = String(raw).trim();
  if (!value) return '/images/placeholder.png';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  if (!apiHost) return path;
  return `${apiHost}${path}`;
}

export default function DepositMethodsPage() {
  useAuthRequired();
  const { t } = useTranslation();

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState<Set<string>>(new Set());

  const apiHost = useMemo(() => {
    const base = API_ROUTES.payments.methods.active;
    try {
      return new URL(base).origin;
    } catch {
      const trimmed = base.replace(/\/api[^]*$/i, '').replace(/\/$/, '');
      if (trimmed) return trimmed;
      if (typeof window !== 'undefined') return window.location.origin;
      return '';
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get<PaymentMethodApi[]>(API_ROUTES.payments.methods.active);
      const list = Array.isArray(data) ? data : [];
      const normalized: PaymentMethod[] = list.map((item) => ({
        ...item,
        logoUrl: item.logoUrl ?? item.logo_url ?? null,
      }));
      setMethods(normalized);
    } catch (e: unknown) {
      const error = e as ErrorResponse;
      const fallback = t('payments.methods.fetch.fail');
      const msg = (error?.response?.data?.message || error?.message || fallback);
      setError(Array.isArray(msg) ? msg.join(', ') : msg);
      setMethods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto bg-bg-base text-text-primary" dir="rtl">
      <h1 className="text-xl font-bold mb-2">{t('payments.deposits.list.pageTitle')}</h1>
      <p className="text-text-secondary mb-6">{t('payments.deposits.list.description')}</p>

      {error && <div className="mb-4 text-danger">{error}</div>}

      {loading ? (
        <div className="text-text-secondary">{t('product.status.loading')}</div>
      ) : methods.length === 0 ? (
        <div className="text-text-secondary">{t('payments.deposits.list.empty')}</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
          {methods.map((m) => (
            <button
              key={m.id}
              onClick={() => router.push(`/payments/deposits/${m.id}`)}
              className={[
                'card relative flex flex-col items-center justify-start p-3',
                'hover:bg-bg-surface-alt transition outline-none',
                'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-0'
              ].join(' ')}
              aria-label={t('payments.deposits.list.selectAria', { name: m.name })}
            >
              <div className="w-full h-20 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={failed.has(m.id) ? '/images/placeholder.png' : resolveLogoUrl(m.logoUrl, apiHost)}
                  alt={m.name}
                  className="max-h-full max-w-[6rem] object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  onError={() =>
                    setFailed((prev) => {
                      if (prev.has(m.id)) return prev;
                      const next = new Set(prev);
                      next.add(m.id);
                      return next;
                    })
                  }
                />
              </div>

              <div className="w-full text-center">
                <div className="leading-tight truncate mt-3 text-text-primary">{m.name}</div>
                {m.note && (
                  <div className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                    {m.note}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
