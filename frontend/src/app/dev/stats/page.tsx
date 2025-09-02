export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import DevStatsPageClient from './DevStatsPageClient';
export default function Page(){ return <DevStatsPageClient />; }
