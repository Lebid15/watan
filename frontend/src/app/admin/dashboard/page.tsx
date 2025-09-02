export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { Suspense } from 'react';
// @ts-ignore ensure resolution at build time
import AdminDashboardPageClient from './AdminDashboardPageClient';

export default function AdminDashboardWrapper() {
  return (
    <Suspense fallback={null}>
      <AdminDashboardPageClient />
    </Suspense>
  );
}
