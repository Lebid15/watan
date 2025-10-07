'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { API_ROUTES } from '@/utils/api';
import { FiLogOut, FiAlertCircle, FiShoppingCart, FiUsers, FiDollarSign, FiShare2 } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

type Props = {
  alertMessage?: string; // legacy prop (still supported)
  onLogout: () => void | Promise<void>;
  pendingOrdersCount?: number;
  pendingDepositsCount?: number;
};

interface NoteResp { value: string; updatedAt: string | null }

export default function AdminTopBar({ alertMessage, onLogout, pendingOrdersCount = 0, pendingDepositsCount = 0 }: Props) {
  const { t } = useTranslation('common');
  const [pending, setPending] = useState(false);
  const [devNote, setDevNote] = useState<NoteResp | null>(null);
  const [loadingNote, setLoadingNote] = useState(true);
  const [banner, setBanner] = useState<{ text: string; enabled: boolean } | null>(null);

  // Fetch public developer note (cached server side via service ttl)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<NoteResp>('/dev/notes/public/latest');
        if (!cancelled) setDevNote(res.data);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoadingNote(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Fetch public banner for the current tenant, prioritizing it over dev note if enabled
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Resolve tenant host similar to MainHeader
        let tenantHost: string | undefined;
        try {
          const m = typeof document !== 'undefined' && document.cookie.match(/(?:^|; )tenant_host=([^;]+)/);
          if (m && m[1]) tenantHost = decodeURIComponent(m[1]);
          if (!tenantHost && typeof window !== 'undefined') tenantHost = window.location.host;
          if (!tenantHost && process.env.NEXT_PUBLIC_TENANT_HOST) tenantHost = process.env.NEXT_PUBLIC_TENANT_HOST;
        } catch {}
        const url = '/api-dj/pages/banner';
        const res = await fetch(url, { method: 'GET', headers: tenantHost ? { 'X-Tenant-Host': tenantHost } as any : undefined, cache: 'no-store' });
        if (!cancelled && res.ok) {
          const data = await res.json().catch(()=>({}));
          const text = String((data as any).text || '').trim();
          const enabled = Boolean((data as any).enabled);
          setBanner({ text, enabled });
        }
      } catch {
        if (!cancelled) setBanner({ text: '', enabled: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogoutClick = async () => {
    if (pending) return;
    setPending(true);
    try {
      await onLogout();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="bg-bg-surface border-b border-border">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        {/* اليمين: منطقة التنبيهات */}
        <div className="flex-1 flex justify-end">
          {((banner && banner.enabled && banner.text) || alertMessage || (!!devNote?.value && !loadingNote)) && (
            <div
              className="py-2 px-4 max-w-md
                         text-text-primary text-sm
                         border border-border bg-bg-surface-alt
                         rounded-lg flex items-center gap-2 overflow-hidden"
              role="status"
              aria-live="polite"
            >
              <FiAlertCircle className="text-text-primary shrink-0" size={18} />
              <span className="truncate" title={(banner?.enabled && banner?.text) || alertMessage || devNote?.value}>
                {(banner?.enabled && banner?.text) || alertMessage || devNote?.value}
              </span>
            </div>
          )}
        </div>

        {/* الوسط: أيقونات سهولة الوصول */}
        <div className="flex items-center gap-1">
          <div className="inline-flex items-center gap-3 bg-bg-surface-alt text-text-primary border border-border rounded-md px-3 py-1.5">
            {/* الطلبات */}
            <Link
              href="/admin/orders"
              className="relative p-1 rounded hover:bg-primary/15 transition"
              title={pendingOrdersCount > 0 ? t('admin.shortcuts.ordersPending', { count: pendingOrdersCount }) : t('admin.shortcuts.orders')}
            >
              <FiShoppingCart size={22} className="text-text-primary" />
              {pendingOrdersCount > 0 && (
                <span className="absolute -top-2 -end-2 bg-green-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-bg-surface-alt shadow-lg">
                  {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
                </span>
              )}
            </Link>

            {/* الدفعات (إيداعات) */}
            <Link
              href="/admin/payments/deposits"
              className="relative p-1 rounded hover:bg-primary/15 transition"
              title={
                pendingDepositsCount > 0
                  ? t('admin.shortcuts.depositsPending', { count: pendingDepositsCount })
                  : t('admin.shortcuts.deposits')
              }
            >
              <FiDollarSign size={22} className="text-text-primary" />
              {pendingDepositsCount > 0 && (
                <span className="absolute -top-2 -end-2 bg-green-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full border-2 border-bg-surface-alt shadow-lg">
                  {pendingDepositsCount > 99 ? '99+' : pendingDepositsCount}
                </span>
              )}
            </Link>

            {/* المستخدمون */}
            <Link
              href="/admin/users"
              className="p-1 rounded hover:bg-primary/15 transition"
              title={t('admin.shortcuts.users')}
            >
              <FiUsers size={22} />
            </Link>

            {/* إعدادات API للمنتجات */}
            <Link
              href="/admin/products/api-settings"
              className="p-1 rounded hover:bg-primary/15 transition"
              title={t('admin.shortcuts.apiSettings')}
            >
              <FiShare2 size={22} />
            </Link>
          </div>
        </div>

        {/* اليسار: زر الخروج */}
        <div className="flex-1 flex justify-start">
          <button
            onClick={handleLogoutClick}
            disabled={pending}
            className="bg-red-600 text-white px-4 py-2 rounded-lg 
                       hover:bg-red-700 transition
                       disabled:opacity-60 disabled:cursor-not-allowed
                       flex items-center gap-2"
            title="تسجيل الخروج"
            aria-label="تسجيل الخروج"
            aria-busy={pending}
          >
            {pending ? (
              <svg
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4A4 4 0 004 12z"/>
              </svg>
            ) : (
              <FiLogOut size={20} />
            )}
            <span className="hidden md:inline">خروج</span>
          </button>
        </div>
      </div>
    </div>
  );
}
