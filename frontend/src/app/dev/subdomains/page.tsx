// src/app/admin/subdomains/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import SubdomainsPageClient from './SubdomainsPageClient';
export default function Page(){ return <SubdomainsPageClient />; }
