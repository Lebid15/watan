export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import CatalogProductDetailsClient from './CatalogProductDetailsClient';
export default function Page({ params }: { params: { id: string } }) { return <CatalogProductDetailsClient id={params.id} />; }
