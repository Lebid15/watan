'use client';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic'; // إزالة revalidate / fetchCache طبقًا للتعليمات

export default function DevSettingsLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
