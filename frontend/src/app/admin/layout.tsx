// app/admin/layout.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { Suspense } from 'react';
// @ts-ignore build-time resolution
import AdminLayoutClient from './layoutClient';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminLayoutClient>{children}</AdminLayoutClient>
    </Suspense>
  );
}
