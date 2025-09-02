export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import CatalogProductDetailsClient from './CatalogProductDetailsClient';
// Next type generator (in this repo setup) expects params sometimes as a Promise; accept both.
export default async function Page(props: { params: { id: string } } | { params: Promise<{ id: string }> }) {
	let id: string = '';
	try {
		const raw: any = props.params;
		if (raw && typeof raw.then === 'function') {
			const resolved = await (raw as Promise<{ id: string }>);
			id = resolved?.id || '';
		} else if (raw && typeof raw === 'object') {
			id = (raw as { id?: string }).id || '';
		}
	} catch {}
	return <CatalogProductDetailsClient id={id} />;
}
