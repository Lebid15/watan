'use client';
import { Suspense } from 'react';
import NextDynamic from 'next/dynamic';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

// إعادة استخدام صفحة الأمان العامة كـ Client Component
const SecurityPage = NextDynamic(
  () => import('@/app/security/page').then(m => m.default),
  { ssr: false }
);

export default function DevSecurityPage() {
  return (
    <Suspense fallback={null}>
      <SecurityPage />
    </Suspense>
  );
}
