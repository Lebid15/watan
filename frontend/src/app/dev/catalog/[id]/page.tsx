// @ts-nocheck
'use client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import CatalogProductDetailsClient from './CatalogProductDetailsClient';
import { useParams } from 'next/navigation';
// NOTE: Next type generator currently expects params: Promise<...>. We accept Promise<any> in the signature
// indirectly by not declaring a props parameter (avoid mismatch) and rely on useParams at runtime.
// If future generator relaxes, this can remain stable.
export default function Page() {
  const { id } = useParams<{ id: string }>();
  return <CatalogProductDetailsClient id={id} />;
}
