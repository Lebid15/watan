// src/app/admin/products/ProductsNavbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ProductsNavbar() {
  const pathname = usePathname();

  const navItems = [
    { name: 'قائمة المنتجات', href: '/admin/products' },
    { name: 'مجموعات الأسعار', href: '/admin/products/price-groups' },
    { name: 'ربط المستخدمين بالأسعار', href: '/admin/products/price-groups/users' },
    { name: 'العملات', href: '/admin/products/currencies' },
    { name: 'إعدادات API', href: '/admin/products/api-settings' },
    { name: 'الأكواد الرقمية', href: '/admin/products/codes' },
    { name: 'توجيه الباقات', href: '/admin/products/package-routing' },
    // محذوف مؤقتًا: تفعيل الكتالوج, تحليل الصور
  ];

  const isActive = (href: string) => {
    // Normalize pathnames to avoid trailing-slash confusion
    const norm = (s: string) => (s.endsWith('/') && s.length > 1) ? s.slice(0, -1) : s;
    const p = norm(pathname);
    const h = norm(href);
    if (p === h) return true;
    // Only treat as active if it's a subroute of href AND not exactly another tab href
    if (p.startsWith(h + '/')) {
      const clashes = navItems.some(item => norm(item.href) !== h && p === norm(item.href));
      if (!clashes) return true;
    }
    return false;
  };

  return (
    <nav className="bg-subnav border-b border-border shadow-sm" dir="rtl" aria-label="تبويب المنتجات">
      <div className="max-w-7xl mx-auto px-3 sm:px-4">
        <div className="flex items-stretch gap-1 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={[
                  'relative px-3 sm:px-4 py-2 text-[15px] whitespace-nowrap rounded-t-md transition-colors',
                  'border-b-2',
                  active
                    ? 'bg-bg-surface text-text-primary border-primary'
                    : 'bg-subnav text-text-secondary border-transparent hover:text-text-primary hover:border-border'
                ].join(' ')}
              >
                {active && (
                  <span
                    className="pointer-events-none absolute inset-x-2 -bottom-[2px] h-0.5 rounded-full bg-primary"
                    aria-hidden
                  />
                )}
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
