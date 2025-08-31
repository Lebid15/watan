'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import api, { API_ROUTES, API_BASE_URL } from '@/utils/api';
import { ErrorResponse } from '@/types/common';

/* =======================
   عناصر مساعدة مع بحث
   ======================= */

type SimpleOption = { id: string; name: string };
type ProductLite = { id: string; name: string; isActive?: boolean };

function useClickAway<T extends HTMLElement>(onAway: () => void) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onAway();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onAway]);
  return ref;
}

/** ComboBox: زر يفتح قائمة فيها input للبحث + عناصر. يسمح بإدخال حرّ */
function SearchableCombo({
  value,
  onChange,
  placeholder,
  options,
  buttonClass,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: string[];
  buttonClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false));

  const filtered = useMemo(() => {
    const uniq = Array.from(new Set(options)).filter(Boolean);
    if (!q) return uniq.slice(0, 200);
    return uniq.filter((s) => s.toLowerCase().includes(q.toLowerCase())).slice(0, 200);
  }, [q, options]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          buttonClass ??
          'px-3 py-1.5 rounded-md border border-border bg-bg-surface text-text-primary'
        }
        title={value || placeholder}
      >
        {value || placeholder || 'Select'}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-64 rounded-md border border-border bg-bg-surface shadow-lg text-text-primary">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث…"
              className="input w-full"
            />
          </div>
          <div className="max-h-60 overflow-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-text-secondary">لا نتائج</div>
            )}
            {filtered.map((opt) => (
              <button
                key={opt}
                className={`w-full text-right px-3 py-2 text-sm hover:bg-bg-surface-alt ${
                  opt === value ? 'bg-bg-surface-alt font-medium' : ''
                }`}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                  setQ('');
                }}
              >
                {opt}
              </button>
            ))}
            {/* اختيار حر */}
            {q && (
              <button
                className="w-full text-right px-3 py-2 text-sm text-link hover:bg-bg-surface-alt border-t border-border"
                onClick={() => {
                  onChange(q);
                  setOpen(false);
                  setQ('');
                }}
              >
                استخدم: “{q}”
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Select بقائمة مع بحث في الأعلى (لباقات المزود) */
function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string | null;
  onChange: (v: string) => void;
  options: SimpleOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useClickAway<HTMLDivElement>(() => setOpen(false));

  const filtered = useMemo(() => {
    if (!q) return options;
    return options.filter(
      (o) =>
        o.name.toLowerCase().includes(q.toLowerCase()) ||
        String(o.id).toLowerCase().includes(q.toLowerCase())
    );
  }, [q, options]);

  const selected = value ? options.find((o) => String(o.id) === String(value)) : null;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="border border-border rounded-md px-2 py-1 w-72 bg-bg-surface text-text-primary text-left truncate"
        title={selected ? `${selected.name} (${selected.id})` : placeholder}
      >
        {selected ? `${selected.name} (${selected.id})` : placeholder || 'Select…'}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[22rem] rounded-md border border-border bg-bg-surface shadow-lg text-text-primary">
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث عن الباقة…"
              className="input w-full"
            />
          </div>
          <div className="max-h-72 overflow-auto">
            <button
              className={`w-full text-right px-3 py-2 text-sm hover:bg-bg-surface-alt ${
                !value ? 'bg-bg-surface-alt font-medium' : ''
              }`}
              onClick={() => {
                onChange('');
                setOpen(false);
                setQ('');
              }}
            >
              — إختر باقة  —
            </button>

            {filtered.map((o) => (
              <button
                key={String(o.id)}
                className={`w-full text-right px-3 py-2 text-sm hover:bg-bg-surface-alt ${
                  String(o.id) === String(value) ? 'bg-bg-surface-alt font-medium' : ''
                }`}
                onClick={() => {
                  onChange(String(o.id));
                  setOpen(false);
                  setQ('');
                }}
                title={`${o.name} (${o.id})`}
              >
                {o.name} <span className="text-text-secondary">({o.id})</span>
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-text-secondary">لا نتائج</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =======================
   سعر الصرف (USD → TRY)
   ======================= */

type CurrencyRow = { code?: string; currencyCode?: string; rate?: number; value?: number; fx?: number };

async function loadTryRateFromApi(): Promise<number | null> {
  // نحاول أكثر من مسار محتمل حسب بنية الـ API لديك
  const candidates: string[] = [
    ((API_ROUTES as Record<string, unknown>)?.currencies as Record<string, unknown>)?.base as string,
    (((API_ROUTES as Record<string, unknown>)?.admin as Record<string, unknown>)?.currencies as Record<string, unknown>)?.base as string,
    `${API_BASE_URL}/currencies`,
    `${API_BASE_URL}/admin/currencies`,
  ].filter((u): u is string => Boolean(u));

  for (const url of candidates) {
    try {
      const { data } = await api.get<unknown>(url);
      const dataRecord = data as Record<string, unknown>;
      const list: CurrencyRow[] = Array.isArray(data) ? data : Array.isArray(dataRecord?.items) ? dataRecord.items as CurrencyRow[] : [];
      const tryRow =
        list.find((c) => String(c.code || c.currencyCode).toUpperCase() === 'TRY') || null;

      if (tryRow) {
        // التقط أي حقل يمثل "كم ليرة لكل 1 دولار"
        const v = [tryRow.rate, tryRow.value, tryRow.fx]
          .map((x) => Number(x))
          .find((x) => !Number.isNaN(x) && x > 0);
        if (v && v > 0) return v;
      }
    } catch {
      // جرّب التالي
    }
  }
  return null;
}

/* =======================
   الصفحة الأصلية
   ======================= */

type ProviderPkg = { id: string; name: string };
type Row = {
  our_package_id: string;
  our_package_name: string;
  our_base_price: number;        // USD
  provider_price: number | null; // TRY
  current_mapping: string | null;
  provider_packages: ProviderPkg[];
};
type ApiInfo = { id: string; name: string; type: string; balance: number };
type IntegrationConfigRow = {
  id: string;
  name: string;
  provider: 'barakat' | 'apstore' | 'znet';
  baseUrl?: string;
  apiToken?: string;
  kod?: string;
  sifre?: string;
};

export default function IntegrationMappingPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [apiInfo, setApiInfo] = useState<ApiInfo | null>(null);
  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfigRow | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');
  const [msg, setMsg] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  const [product, setProduct] = useState<string>(searchParams.get('product') || '');
  const [productOptions, setProductOptions] = useState<string[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // سعر الصرف: كم ليرة لكل 1 دولار
  const [tryRate, setTryRate] = useState<number | null>(null);
  const toTRY = (usd?: number | null) =>
    tryRate && usd != null ? Number(usd) * tryRate : null;

  useEffect(() => {
    (async () => {
      const rate = await loadTryRateFromApi();
      setTryRate(rate);
    })();
  }, []);

  const mappedCount = useMemo(
    () => rows.filter((r) => r.current_mapping && String(r.current_mapping).length > 0).length,
    [rows]
  );

  // جلب أسماء المنتجات من الـ backend
  const loadProductOptions = async () => {
    setLoadingProducts(true);
    try {
      const { data } = await api.get<ProductLite[]>(API_ROUTES.products.base);
      const names = (Array.isArray(data) ? data : [])
        .filter((p) => p?.isActive !== false)
        .map((p) => p.name)
        .filter(Boolean);
      setProductOptions(Array.from(new Set(names)));
      if (!product && names.length) setProduct(names[0]);
    } catch {
      // تجاهل
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    loadProductOptions();
  }, []);

  // fallback محلي لو فشل جلب المنتجات
  const productSuggestions = useMemo(() => {
    if (productOptions.length) return productOptions;
    const names = rows.map((r) => r.our_package_name?.split(' ')?.[0] || '').filter(Boolean);
    return Array.from(new Set(names));
  }, [productOptions, rows]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    setMsg('');
    try {
      const { data } = await api.get<{ api: ApiInfo; packages: Row[] }>(
        `${API_ROUTES.admin.integrations.packages(String(id))}${
          product ? `?product=${encodeURIComponent(product)}` : ''
        }`
      );
      setApiInfo(data.api);
      setRows(data.packages || []);

      const listRes = await api.get<IntegrationConfigRow[]>(API_ROUTES.admin.integrations.base);
      const found = (listRes.data || []).find((x) => x.id === String(id)) || null;
      setIntegrationConfig(found);
    } catch (e: unknown) {
      const error = e as ErrorResponse;
      setError(error?.response?.data?.message || error?.message || 'Failed to load mapping');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id, product]);

  const applyFilter = async () => {
    const qp = new URLSearchParams(searchParams.toString());
    if (product) qp.set('product', product);
    else qp.delete('product');
    // إبقاء ProductsNavbar
    router.replace(`/admin/products/integrations/${id}?${qp.toString()}`);
    await load();
  };

  const updateRowMapping = (ourId: string, providerId: string) => {
    setRows((prev) =>
      prev.map((r) => (r.our_package_id === ourId ? { ...r, current_mapping: providerId } : r))
    );
  };

  const saveAll = async () => {
    setSaving(true);
    setError('');
    setMsg('');
    try {
      const payload = rows
        .filter((r) => r.current_mapping && String(r.current_mapping).length > 0)
        .map((r) => ({
          our_package_id: r.our_package_id,
          provider_package_id: String(r.current_mapping),
        }));
      await api.post(API_ROUTES.admin.integrations.packages(String(id)), payload);
      setMsg('تم حفظ الربط بنجاح.');
      await load();
    } catch (e: unknown) {
      const error = e as ErrorResponse;
      setError(error?.response?.data?.message || error?.message || 'Failed to save mappings');
    } finally {
      setSaving(false);
    }
  };

  const syncProviderProducts = async () => {
    if (!id) return;
    setSyncing(true);
    setError('');
    setMsg('');
    try {
      await api.post(API_ROUTES.admin.integrations.syncProducts(String(id)));
      setMsg('تمت مزامنة باقات المزود. يتم التحديث…');
      await load();
    } catch (e: unknown) {
      const error = e as ErrorResponse;
      setError(error?.response?.data?.message || error?.message || 'Failed to sync provider products');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-4 md:p-6 text-text-primary">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-semibold">ربط الباقات</h1>
        </div>

        <div className="flex flex-col gap-2">
          {apiInfo && (
            <div className="text-sm card">
              <div>
                <span className="font-medium">الجهة:</span> {apiInfo.name} ({apiInfo.type})
              </div>
              <div>
                <span className="font-medium">الرصيد:</span> {apiInfo.balance}
              </div>
            </div>
          )}
          {integrationConfig && (
            <div className="text-xs card">
              <div className="truncate">
                <span className="font-medium">الرابط:</span>&nbsp;
                <span className="font-mono">{integrationConfig.baseUrl || '—'}</span>
              </div>
              <div className="truncate">
                <span className="font-medium">التوكن:</span>&nbsp;
                <span className="font-mono">{integrationConfig.apiToken || '—'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap items-center gap-2 ml-4 card">
          <span className="text-sm mr-1">اختر منتجاً:</span>
          <div className="relative inline-block">
            <SearchableCombo
              value={product}
              onChange={setProduct}
              placeholder={loadingProducts ? 'المنتجات تُحضر…' : 'إختر منتجاً'}
              options={productSuggestions}
              buttonClass="px-3 py-1.5 rounded-md text-sm border border-border bg-bg-surface text-text-primary pr-8"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
              ▼
            </span>
          </div>
          <button
            onClick={applyFilter}
            className="btn btn-secondary"
            disabled={loading}
          >
            تأكيد
          </button>
        </div>

        <button
          onClick={load}
          className="btn btn-secondary"
          disabled={loading}
        >
          تحديث
        </button>
        <button
          onClick={syncProviderProducts}
          className="btn btn-primary disabled:opacity-50"
          disabled={syncing || loading}
          title="Sync provider packages"
        >
          {syncing ? 'جاري التحديث…' : 'تحديث باقات الطرف الآخر لدينا'}
        </button>
        <div className="ml-auto text-sm">
          <span className="font-medium">تم ربط {mappedCount}</span> من أصل {rows.length}
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 rounded-md border border-danger/40 bg-danger/10 text-danger">
          {error}
        </div>
      )}
      {msg && (
        <div className="mb-3 p-3 rounded-md border border-success/40 bg-success/10 text-success">
          {msg}
        </div>
      )}

      <div className="table-wrap">
        <table className="table text-right">
          <thead>
            <tr>
              <th>الباقات</th>
              <th>رأس المال</th>
              <th>سعر الطرف الآخر</th>
              <th>الفرق</th>
              <th>باقة المزود</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-text-secondary">
                  لا يوجد باقات لعرضها
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-text-secondary">
                  يحمل...
                </td>
              </tr>
            )}

            {rows.map((r) => {
              // رأس المال بالدولار → ليرة (لو توفّر سعر الصرف)
              const baseTRY = toTRY(r.our_base_price);
              // الفرق = سعر المزود (TRY) - رأس المال (TRY)
              const diff = (r.provider_price == null || baseTRY == null)
                ? null
                : (r.provider_price - baseTRY);
              const diffClass =
                diff == null
                  ? 'text-text-secondary'
                  : diff < 0
                  ? 'text-success'
                  : diff > 0
                  ? 'text-warning'
                  : 'text-text-primary';

              return (
                <tr key={r.our_package_id} className="hover:bg-primary/5">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.our_package_name}</div>
                    <div className="text-xs text-text-secondary">{r.our_package_id}</div>
                  </td>

                  {/* رأس المال بالليرة + ≈ USD */}
                  <td className="px-3 py-2">
                    {baseTRY != null ? (
                      <div className="leading-tight">
                        <div>
                          {baseTRY.toFixed(2)} <span className="text-text-secondary">TRY</span>
                        </div>
                        <div className="text-xs text-text-secondary">
                          ≈ {Number(r.our_base_price).toFixed(2)} USD
                        </div>
                      </div>
                    ) : (
                      <div className="leading-tight">
                        <div>
                          {Number(r.our_base_price).toFixed(2)}{' '}
                          <span className="text-text-secondary">USD</span>
                        </div>
                        <div className="text-xs text-warning">
                          لم يتم تحميل سعر الصرف (TRY)
                        </div>
                      </div>
                    )}
                  </td>

                  {/* سعر المزود (هو أصلًا بالليرة) */}
                  <td className="px-3 py-2">
                    {r.provider_price == null ? '—' : (
                      <>
                        {Number(r.provider_price).toFixed(2)}{' '}
                        <span className="text-text-secondary">TRY</span>
                      </>
                    )}
                  </td>

                  {/* الفرق بالليرة */}
                  <td className={`px-3 py-2 ${diffClass}`}>
                    {diff == null ? '—' : `${diff.toFixed(3)} TRY`}
                  </td>

                  <td className="px-3 py-2">
                    <SearchableSelect
                      value={r.current_mapping}
                      onChange={(v) => updateRowMapping(r.our_package_id, v)}
                      options={r.provider_packages.map((pp) => ({
                        id: String(pp.id),
                        name: pp.name,
                      }))}
                      placeholder="— إختر باقة للربط —"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={saveAll}
          disabled={saving || loading}
          className="btn bg-success text-text-inverse hover:brightness-110 disabled:opacity-50"
        >
          {saving ? 'يتم الحفظ…' : 'حفظ'}
        </button>
        <button
          onClick={() => router.push('/admin/products/api-settings')}
          className="btn btn-secondary"
        >
          رجوع
        </button>
      </div>
    </div>
  );
}
