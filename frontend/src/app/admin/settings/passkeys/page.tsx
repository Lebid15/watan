export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { Suspense } from 'react';
import PasskeysPageClient from './passkeysPageClient';

export default function AdminSettingsPasskeysPageWrapper(){
	return <Suspense fallback={null}><PasskeysPageClient /></Suspense>;
}
