'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function PaymentsNavbar() {
  const pathname = usePathname();
  const links = [
    { name: 'وسائل الدفع', href: '/admin/payments/methods' },
    { name: 'طلبات الإيداع', href: '/admin/payments/deposits' },
  ];

  return (
    <div className="w-full bg-bg-subnav border-b">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col sm:flex-row gap-2">
        {links.map((l) => {
          const active = pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-contrast'
                  : 'bg-bg-surface-alt text-text-primary/90 border-transparent hover:bg-primary/10 hover:text-text-primary'
              }`}
            >
              {l.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
