'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ReportsNavbar() {
  const pathname = usePathname();

  const items = [
    { name: 'الأرباح', href: '/admin/reports/profits' },
    { name: 'جرد رأس المال', href: '/admin/reports/capital' },
  ];

  return (
    <div className="w-full border-b border-border bg-bg-surface">
      <div className="max-w-7xl mx-auto px-4 py-2 flex gap-2">
        {items.map((it) => {
          const active = pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={[
                'px-3 py-1.5 rounded-md text-sm transition',
                active
                  ? 'bg-primary text-primary-contrast'
                  : 'text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary',
              ].join(' ')}
            >
              {it.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
