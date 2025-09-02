'use client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import { useEffect, useMemo, useState } from 'react';
import api from '@/utils/api';
import { useDebounce } from '@/utils/format';

type CatalogProduct = {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  sourceProviderId?: string | null;
  externalProductId?: string | null;
  isActive: boolean;
  packagesCount?: number;
};

type ProviderRow = { id: string; name: string; provider: string };
type ListResp = CatalogProduct[] | { items?: CatalogProduct[] } | unknown;

// helper
function extractItems<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
    return (data as any).items as T[];
  }
  return [];
}

function normalizeProducts(data: ListResp): CatalogProduct[] {
  if (Array.isArray(data)) return data as CatalogProduct[];
  if (data && typeof data === 'object' && 'items' in (data as any)) {
    return ((data as any).items ?? []) as CatalogProduct[];
  }
  return [];
}

export default function CatalogPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(q, 300);

  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const providerMap = useMemo(() => {
    const m = new Map<string, { code: string; name: string }>();
    for (const p of providers) m.set(p.id, { code: (p.provider || '').toLowerCase(), name: p.name });
    return m;
  }, [providers]);
  const [pv, setPv] = useState<'all' | 'znet' | 'barakat' | 'apstore'>('all');

  async function loadProducts() {
    setLoading(true);
    try {
      const url = debounced
        ? `/admin/catalog/products?withCounts=1&q=${encodeURIComponent(debounced)}`
        : `/admin/catalog/products?withCounts=1`;
      const res = await api.get(url);
      setItems(normalizeProducts(res.data));
    } finally {
      setLoading(false);
    }
  }

  async function loadProviders() {
    try {
      const res = await api.get('/admin/providers/dev');
      const list: ProviderRow[] = extractItems<ProviderRow>(res.data);
      setProviders(list);
    } catch {
      setProviders([]);
    }
  }

  useEffect(() => { loadProviders(); }, []);
  useEffect(() => { loadProducts(); }, [debounced]);

  const filtered = useMemo(() => {
    if (pv === 'all') return items;
    return items.filter((p) => {
      const pid = p.sourceProviderId ?? '';
      const prov = providerMap.get(pid)?.code ?? '';
      return prov.includes(pv);
    });
  }, [items, providerMap, pv]);

  const aggregates = useMemo(() => {
    const agg = {
      all: { products: 0, packages: 0 },
      znet: { products: 0, packages: 0 },
      barakat: { products: 0, packages: 0 },
      apstore: { products: 0, packages: 0 },
    };
    for (const p of items) {
      const provCode = providerMap.get(p.sourceProviderId ?? '')?.code ?? '';
      const pkg = p.packagesCount ?? 0;
      agg.all.products++; agg.all.packages += pkg;
      if (provCode.includes('znet')) { agg.znet.products++; agg.znet.packages += pkg; }
      if (provCode.includes('barakat')) { agg.barakat.products++; agg.barakat.packages += pkg; }
      if (provCode.includes('apstore')) { agg.apstore.products++; agg.apstore.packages += pkg; }
    }
    return agg;
  }, [items, providerMap]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">كتالوج المنتجات</h1>

      <div className="flex items-center gap-2">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'znet', label: 'ZNET' },
          { key: 'barakat', label: 'Barakat' },
          { key: 'apstore', label: 'Apstore' },
        ].map((t) => {
          const ag = aggregates[t.key as keyof typeof aggregates] || { products: 0, packages: 0 };
          return (
            <button
              key={t.key}
              onClick={() => setPv(t.key as any)}
              className={`px-3 py-1.5 rounded-full text-sm border flex flex-col items-center justify-center leading-tight ${pv === t.key ? 'bg-black text-white border-black' : 'hover:bg-zinc-100'}`}
            >
              <span>{t.label} ({ag.products})</span>
              <span className={`text-[10px] ${pv === t.key ? 'text-white/80' : 'text-zinc-500'}`}>باقات {ag.packages}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث بالاسم…"
          className="px-3 py-2 rounded-lg border bg-white w-80"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {filtered.map((p) => {
          const provCode = providerMap.get(p.sourceProviderId ?? '')?.code ?? '';
          const provName = providerMap.get(p.sourceProviderId ?? '')?.name ?? (provCode || 'internal');
          return (
            <a
              key={p.id}
              href={`/dev/catalog/${p.id}?pv=${encodeURIComponent(pv)}`}
              className="rounded-xl border bg-white p-3 hover:shadow"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-zinc-100 flex items-center justify-center">
                  {p.imageUrl ? <img src={p.imageUrl} alt="" className="h-12 w-12 object-cover rounded-lg" /> : <span>📦</span>}
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-zinc-500">
                    {p.externalProductId ? `ext:${p.externalProductId}` : 'internal'}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="text-[11px] px-2 py-0.5 rounded-full border text-zinc-700">{provName}</div>
                  <div className="text-[11px] px-2 py-0.5 rounded-full border bg-zinc-50">
                    {p.packagesCount ?? 0} باقة
                  </div>
                </div>
              </div>
            </a>
          );
        })}
        {filtered.length === 0 && !loading && (
          <div className="text-sm text-zinc-500">لا توجد منتجات مطابقة</div>
        )}
      </div>

      {loading && <div className="text-sm text-zinc-600">جارٍ التحميل…</div>}
    </div>
  );
}
