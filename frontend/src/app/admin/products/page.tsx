export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { Suspense } from 'react';
// @ts-ignore build-time resolution
import ProductsPageClient from './ProductsPageClient';
export default function ProductsPageWrapper(){
  return <Suspense fallback={null}><ProductsPageClient /></Suspense>;
}
