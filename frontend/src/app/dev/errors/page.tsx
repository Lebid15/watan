export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { Suspense } from 'react';
import ErrorsPageClient from './ErrorsPageClient';

export default function Page(){
  return <Suspense fallback={<div className="text-sm text-gray-500">...</div>}><ErrorsPageClient /></Suspense>;
}
