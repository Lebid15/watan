// app/layout.tsx (Tenants App)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { Suspense } from 'react';
import { Cairo } from 'next/font/google';
import './globals.css';
// @ts-ignore build-time resolution
import AdminLayoutClient from './layoutClient';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-cairo',
  display: 'swap',
});

export default function TenantsLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className={cairo.className}>
        <Suspense fallback={null}>
          <AdminLayoutClient>{children}</AdminLayoutClient>
        </Suspense>
      </body>
    </html>
  );
}
