'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MdLogout } from 'react-icons/md';
import { performLogout } from '@/utils/logout';

const baseTabs = [
  { href: '/dev', label: 'لوحة المطوّر' },
  { href: '/dev/subdomains', label: 'Subdomains' },
  { href: '/dev/stats', label: 'الإحصائيات' },
  { href: '/dev/errors', label: 'الأخطاء' },
];

export default function DevNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/dev') return pathname === '/dev';
    return pathname === href || pathname.startsWith(href + '/');
  };

  const logout = () => {
    performLogout();
    router.push('/login');
  };

  const featureBilling = process.env.NEXT_PUBLIC_FEATURE_BILLING_V1 === 'true' || process.env.NEXT_PUBLIC_FEATURE_BILLING_V1 === '1';
  const featureFilteredProducts = true; // لاحقاً يمكن ربطه بفلاغ بيئة
  const tabs = [
    ...baseTabs,
    ...(featureBilling ? [{ href: '/dev/billing', label: 'Billing' }] : []),
    ...(featureFilteredProducts ? [{ href: '/dev/filtered-products', label: 'منتجات مُفلترة' }] : []),
  { href: '/dev/settings', label: 'الإعدادات' },
  ];

  return (
    <nav className="w-full border-b backdrop-blur sticky top-0 z-20 bg-red-500 text-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        {/* <div className="text-xl font-bold">Developer Portal</div> */}
        <div className="flex gap-2 flex-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={`px-3 py-1.5 rounded text-sm whitespace-nowrap ${
                  active ? 'bg-red-800 text-white' : 'hover:bg-red-600'
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
  <div className="flex items-center gap-2">
          <button
            onClick={logout}
            className="px-3 py-1.5 rounded-full bg-black/50 hover:bg-black/40 flex items-center justify-center"
            title="تسجيل خروج"
          >
            <MdLogout className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
