'use client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import CatalogPageClient from './CatalogPageClient';
export default function Page(){ return <CatalogPageClient />; }
