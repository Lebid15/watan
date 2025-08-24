'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MdLogout } from 'react-icons/md';

const tabs = [
  { href: '/dev', label: 'لوحة المطوّر' },
  { href: '/dev/providers', label: 'المزوّدون' },
  { href: '/dev/catalog', label: 'الكتالوج' },
  { href: '/dev/catalog-images', label: 'صور الكتالوج' },
  { href: '/dev/subdomains', label: 'Subdomains' }, // ✅ الجديد
  { href: '/dev/stats', label: 'الإحصائيات' },
  { href: '/dev/errors', label: 'الأخطاء' },
];

export default function DevNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  // ✅ يضبط الـ active بحيث لا يعتبر /dev/catalog-images ضمن /dev/catalog
  const isActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/dev') return pathname === '/dev';
    return pathname === href || pathname.startsWith(href + '/');
  };

  async function logout() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('role');
        localStorage.removeItem('user');
      }
      const expire = 'Max-Age=0; path=/';
      document.cookie = `access_token=; ${expire}`;
      document.cookie = `role=; ${expire}`;
      document.cookie = `refresh_token=; ${expire}`;

      router.push('/login');
    } catch {
      router.push('/login');
    }
  }

  return (
    <nav className="w-full border-b backdrop-blur sticky top-0 z-20 bg-red-500 text-white">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-4">
        <div className="text-xl font-bold">Developer Portal</div>

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

        {/* زر خروج */}
        <button
          onClick={logout}
          className="px-3 py-1.5 rounded-full bg-black/50 hover:bg-black/40 flex items-center justify-center"
          title="تسجيل خروج"
        >
          <MdLogout className="w-5 h-5" />
        </button>
      </div>
    </nav>
  );
}
