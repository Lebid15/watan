// src/components/layout/MainHeader.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { FaUserCircle } from 'react-icons/fa';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@/context/UserContext';
import { formatGroupsDots } from '@/utils/format';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';

function currencySymbol(code?: string) {
  switch ((code || '').toUpperCase()) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'TRY': return '₺';
    case 'EGP': return '£';
    case 'SAR': return '﷼';
    case 'AED': return 'د.إ';
    case 'SYP': return 'ل.س';
    default: return code || '';
  }
}

export default function MainHeader() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [banner, setBanner] = useState<{ text: string; enabled: boolean } | null>(null);
  const [hideBanner, setHideBanner] = useState<boolean>(false);
  const { t, i18n } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);
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

  // ⬅️ خذ القيم الموجودة فعلًا في الـ Context
  const { user, refreshProfile: refreshUser, logout } = useUser();

  // حدّث بيانات المستخدم عند تحميل الهيدر (لو فيه توكن)
  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // اجلب نص شريط الإعلان العام من Django
  useEffect(() => {
    let mounted = true;
    // احترام الإخفاء المؤقت حتى إعادة تحميل الصفحة
    const hidden = typeof window !== 'undefined' && sessionStorage.getItem('banner:hidden') === '1';
    if (hidden) setHideBanner(true);
    (async () => {
      try {
        const url = '/api-dj/pages/banner';
        // Forward tenant host so Django can resolve the tenant when running behind Next.js proxy
        let tenantHost: string | undefined;
        try {
          // 1) cookie set by middleware on subdomains
          const m = typeof document !== 'undefined' && document.cookie.match(/(?:^|; )tenant_host=([^;]+)/);
          if (m && m[1]) tenantHost = decodeURIComponent(m[1]);
          // 2) fallback to current host
          if (!tenantHost && typeof window !== 'undefined') tenantHost = window.location.host;
          // 3) env override for local dev if provided
          if (!tenantHost && process.env.NEXT_PUBLIC_TENANT_HOST) tenantHost = process.env.NEXT_PUBLIC_TENANT_HOST;
        } catch {}
  const headers: Record<string, string> | undefined = tenantHost ? { 'X-Tenant-Host': tenantHost } : undefined;
  const res = await fetch(url, { method: 'GET', headers });
        const ok = res.ok;
        const raw = ok ? await res.json().catch(() => ({})) : {};
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[Banner] GET', url, res.status, raw);
        }
        if (mounted) {
          let text = '';
          let enabled = false;
          if (raw && typeof raw === 'object') {
            const obj = raw as Record<string, unknown>;
            const rawText = obj.text;
            if (typeof rawText === 'string') {
              text = rawText.trim();
            } else if (rawText != null) {
              text = String(rawText).trim();
            }
            const rawEnabled = obj.enabled;
            if (typeof rawEnabled === 'boolean') {
              enabled = rawEnabled;
            } else if (rawEnabled != null) {
              enabled = Boolean(rawEnabled);
            }
          }
          setBanner({ text, enabled });
        }
      } catch (error: unknown) {
        if (process.env.NODE_ENV !== 'production') {
          const message = error instanceof Error ? error.message : String(error ?? '');
          console.warn('[Banner] fetch failed', message);
        }
        if (mounted) setBanner({ text: '', enabled: false });
      }
    })();
    return () => { mounted = false; };
  }, []);

  // إغلاق القائمة عند النقر خارجها أو الضغط على Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const balanceNum = Number(user?.balance ?? 0);
  const safeBalance = Number.isFinite(balanceNum) ? balanceNum : 0;
  const balanceDisplay = formatGroupsDots(safeBalance, 2);

  // في UserContext النوع هو "currency" (وليس currencyCode)
  const curr = (user?.currency || 'USD').toUpperCase();
  const sym = currencySymbol(curr);

  const normalizedRole = (() => {
    const raw = (user?.role || '').toLowerCase();
    if (['instance_owner','owner','admin'].includes(raw)) return 'tenant_owner';
    return raw;
  })();
  const isMerchantFacing = ['tenant_owner','distributor','developer'].includes(normalizedRole);
  const isEndUser = user && !isMerchantFacing;
  const showBanner = !!(banner && banner.enabled && banner.text && !hideBanner && isMerchantFacing);
  const headerTopOffset = showBanner ? 'top-[36px]' : 'top-0';

  if (!namespaceReady) {
    return null;
  }
  return (
    <>
      {showBanner && (
        <div className="fixed top-0 left-0 w-full z-[60] bg-amber-50 text-amber-900 border-b border-amber-200">
          <div className="px-6 py-2 text-sm flex items-start gap-3">
            <div className="flex-1 whitespace-pre-wrap leading-5">{banner?.text}</div>
            <button
              aria-label={t('header.banner.closeAria')}
              className="text-xs px-2 py-1 rounded border border-amber-300 hover:bg-amber-100"
              onClick={() => { setHideBanner(true); try { sessionStorage.setItem('banner:hidden', '1'); } catch {} }}
            >{t('header.banner.hide')}</button>
          </div>
        </div>
      )}
      <header className={`fixed ${headerTopOffset} left-0 w-full z-50 bg-bg-surface text-text-primary px-6 py-3 shadow`}>
      <div className="flex justify-between items-center">
        {/* اليسار: رصيد المحفظة + مبدل اللغة + زر الحساب */}
        <div className="flex items-center gap-2" dir="rtl">
          <span
            className={[
              'text-[13px] font-bold px-3 py-0.5 rounded-full shadow border border-border',
              'bg-bg-surface-alt',
              balanceNum >= 0 ? 'text-success' : 'text-danger',
              'ml-3',
            ].join(' ')}
            title={t('wallet.balance')}
          >
            {balanceDisplay} {sym}
          </span>
          <LanguageSwitcher className="ml-2" />

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md"
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label={t('header.accountMenuToggle')}
            >
              <FaUserCircle className="text-3xl" />
            </button>

            {open && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-56 menu text-text-primary z-[1000]"
              >
                <div className="py-1">
                  <button
                    role="menuitem"
                    className="w-full text-right px-4 py-2 text-sm hover:bg-bg-surface-alt"
                    onClick={() => { setOpen(false); router.push('/user'); }}
                  >
                    {t('nav.profile')}
                  </button>
                  <button
                    role="menuitem"
                    className="w-full text-right px-4 py-2 text-sm hover:bg-bg-surface-alt"
                    onClick={() => { setOpen(false); router.push('/user/favorites'); }}
                  >
                    {t('nav.favorites')}
                  </button>
                    <button
                      role="menuitem"
                      className="w-full text-right px-4 py-2 text-sm hover:bg-bg-surface-alt"
                      onClick={() => { setOpen(false); router.push('/account/api'); }}
                    >
                      {t('nav.api')}
                    </button>
                  {isEndUser && (
                    <button
                      role="menuitem"
                      className="w-full text-right px-4 py-2 text-sm hover:bg-bg-surface-alt"
                      onClick={() => { setOpen(false); router.push('/security'); }}
                    >
                      {t('nav.security')}
                    </button>
                  )}

                  <div className="my-1 border-t border-border" />

                  <button
                    role="menuitem"
                    className="w-full text-right px-4 py-2 text-sm hover:bg-bg-surface-alt text-danger"
                    onClick={() => {
                      setOpen(false);
                      logout(); // ⬅️ استخدم دالة السياق
                    }}
                  >
                    {t('nav.logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* اليمين: اسم المشروع + روابط دورية */}
        <div className="flex items-center gap-4 text-sm select-none">
          {/* عرض اسم المستخدم بدل النص الثابت */}
          <div className="text-xl font-semibold" title={user?.email || user?.username || user?.name || ''}>
            {user?.username || user?.name || t('header.userName.fallback')}
          </div>
          {/* Role aware quick nav */}
          {user?.role === 'tenant_owner' && <nav className="hidden md:flex gap-3">
            <Link className="hover:underline" href="/tenant/products">{t('tenant.products')}</Link>
            <Link className="hover:underline" href="/tenant/users">{t('users.pageTitle')}</Link>
            <Link className="hover:underline" href="/tenant/price-groups">{t('tenant.priceGroups')}</Link>
            <Link className="hover:underline" href="/tenant/reports">{t('reports.nav.group')}</Link>
            <Link className="hover:underline" href="/billing/overview">{t('billing.nav.overview')}</Link>
          </nav>}
          {user?.role === 'distributor' && <nav className="hidden md:flex gap-3">
            <Link className="hover:underline" href="/distributor/products">{t('tenant.products')}</Link>
            <Link className="hover:underline" href="/distributor/price-groups">{t('tenant.priceGroups')}</Link>
            <Link className="hover:underline" href="/distributor/orders">{t('orders.pageTitle')}</Link>
          </nav>}
          {/* تمت إزالة instance_owner (مُطبَّع إلى tenant_owner) */}
        </div>
      </div>
      </header>
    </>
  );
}
