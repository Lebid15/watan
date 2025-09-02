'use client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import CatalogProductDetailsClient from './CatalogProductDetailsClient';
type Params = { id: string };
export default function Page({ params }: { params: Params }) {
	const { id } = params;
	return <CatalogProductDetailsClient id={id} />;
}
