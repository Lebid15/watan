export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import TenantsPageClient from './TenantsPageClient';

export default function AdminTenantsPage() {
  return <TenantsPageClient />;
}
