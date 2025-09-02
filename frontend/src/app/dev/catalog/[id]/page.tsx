export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import CatalogProductDetailsClient from './CatalogProductDetailsClient';

export default function Page(props: any) {
  const id = props?.params?.id ?? '';
  return <CatalogProductDetailsClient id={String(id)} />;
}
