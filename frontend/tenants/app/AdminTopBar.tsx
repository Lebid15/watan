'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import api, { API_ROUTES } from '@/utils/api';
import { FiLogOut, FiAlertCircle, FiShoppingCart, FiUsers, FiDollarSign, FiShare2 } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';

type Props = {
  alertMessage?: string; // legacy prop (still supported)
  onLogout: () => void | Promise<void>;
  pendingOrdersCount?: number;
  pendingDepositsCount?: number;
  onToggleMobileMenu?: () => void;
};

interface NoteResp { value: string; updatedAt: string | null }

const themes = [
  { id: 'light', name: 'فاتح', icon: '☀️' },
  { id: 'dark1', name: 'Dark 1', icon: '🌙' },
  { id: 'dark2', name: 'Dark 2', icon: '🌑' },
  { id: 'dark3', name: 'Dark 3', icon: '🌚' },
  { id: 'dark4', name: 'Dark 4', icon: '💙' },
];

export default function AdminTopBar({ alertMessage, onLogout, pendingOrdersCount = 0, pendingDepositsCount = 0, onToggleMobileMenu }: Props) {
  const { t } = useTranslation('common');
  const [pending, setPending] = useState(false);
  const [devNote, setDevNote] = useState<NoteResp | null>(null);
  const [loadingNote, setLoadingNote] = useState(true);
  const [banner, setBanner] = useState<{ text: string; enabled: boolean } | null>(null);
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light');
  const themeMenuRef = useRef<HTMLDivElement>(null);

  // Load theme from localStorage
  useEffect(() => {
    try {
      const fromAttr = document.documentElement.getAttribute('data-theme');
      const fromLS = localStorage.getItem('theme');
      const initial = fromLS || fromAttr || 'light';
      setCurrentTheme(initial);
    } catch {
      setCurrentTheme('light');
    }
  }, []);

  // Close theme menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setShowThemeMenu(false);
      }
    };

    if (showThemeMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showThemeMenu]);

  const handleThemeChange = (themeId: string) => {
    setCurrentTheme(themeId);
    
    // Apply theme to document
    const el = document.documentElement;
    if (themeId === 'light') {
      el.removeAttribute('data-theme');
    } else {
      el.setAttribute('data-theme', themeId);
    }
    
    // Update meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (meta) {
      meta.content = themeId === 'light' ? '#ffffff' : '#0F1115';
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('theme', themeId);
    } catch {}
    
    setShowThemeMenu(false);
  };

  // Fetch public developer note (cached server side via service ttl)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<NoteResp>('/dev/notes/public/latest');
        if (!cancelled && res.data) setDevNote(res.data as NoteResp);
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
        const res: any = await api.get(API_ROUTES.site.public.banner);
        if (!cancelled && res.data) {
          const text = String(res.data.text || '').trim();
          const enabled = Boolean(res.data.enabled);
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
    <div className="bg-bg-surface border-b border-border shrink-0">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        {/* Mobile Menu Button */}
        {onToggleMobileMenu && (
          <button
            onClick={onToggleMobileMenu}
            className="lg:hidden p-2 rounded-lg hover:bg-primary/10 text-text-primary transition-colors"
            aria-label="فتح القائمة"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}

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
            {/* اختيار الثيم */}
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="p-1 rounded hover:bg-primary/15 transition text-xl"
                title="اختيار الثيم"
              >
                🎨
              </button>
              
              {showThemeMenu && (
                <div className="absolute top-full left-0 mt-2 bg-bg-surface border-2 border-border rounded-lg shadow-xl z-50 min-w-[160px] overflow-hidden">
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => handleThemeChange(theme.id)}
                      className={`w-full px-4 py-2.5 text-right flex items-center gap-3 hover:bg-bg-surface-hover transition-colors ${
                        currentTheme === theme.id ? 'bg-primary/10 border-r-4 border-primary' : ''
                      }`}
                    >
                      <span className="text-xl">{theme.icon}</span>
                      <span className="font-medium">{theme.name}</span>
                      {currentTheme === theme.id && (
                        <span className="mr-auto text-primary">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* الطلبات */}
            <Link
              href="/orders"
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
              href="/payments/deposits"
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
              href="/users"
              className="p-1 rounded hover:bg-primary/15 transition"
              title={t('admin.shortcuts.users')}
            >
              <FiUsers size={22} />
            </Link>

            {/* إعدادات API للمنتجات */}
            <Link
              href="/products/api-settings"
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
