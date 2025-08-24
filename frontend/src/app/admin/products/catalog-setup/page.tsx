'use client';

import { useEffect, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';

type Provider = {
  id: string;
  name: string;
  provider: string;
  baseUrl?: string | null;
};

type ImportCatalogResp = {
  ok?: boolean;
  providerId?: string;
  createdProducts?: number;
  updatedProducts?: number;
  createdPackages?: number;
  updatedPackages?: number;
  total?: number;
};

type EnableProviderResp = {
  ok: boolean;
  providerId: string;
  productsTouched: number;
  createdPackages: number;
  skippedPackages: number;
  totalCatalogPackages: number;
};

type RefreshPricesResp = {
  ok: boolean;
  providerId: string;
  updated: number;
  skippedNoMatch: number;
  skippedNoCost: number;
  skippedNoFx: number;
  totalCandidates: number;
  mode: 'copy' | 'markup';
  markupPercent: number;
  fixedFee: number;
};

// helper
function extractItems<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as any).items)) {
    return (data as any).items as T[];
  }
  return [];
}

export default function CatalogSetupPage() {
  const [items, setItems] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>('');
  const [error, setError] = useState<string>('');

  const [openPriceFor, setOpenPriceFor] = useState<string | null>(null);
  const [mode, setMode] = useState<'copy' | 'markup'>('copy');
  const [markupPercent, setMarkupPercent] = useState<string>('0');
  const [fixedFee, setFixedFee] = useState<string>('0');
  const [onlyZero, setOnlyZero] = useState<boolean>(false);

  async function load() {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const res = await api.get('/admin/providers/dev');
      const list: Provider[] = extractItems<Provider>(res.data);
      setItems(list);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'فشل تحميل المزوّدين');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleImport(providerId: string) {
    setBusyId(providerId);
    setNotice('');
    setError('');
    try {
      const { data } = await api.post<ImportCatalogResp>(`/admin/providers/${providerId}/catalog-import`);
      setNotice(`تم الاستيراد: منتجات ${data.createdProducts ?? 0} / باقات ${data.createdPackages ?? 0} (الإجمالي: ${data.total ?? 0})`);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'فشل الاستيراد');
    } finally {
      setBusyId(null);
    }
  }

  async function handleEnableAllForProvider(providerId: string) {
    setBusyId(providerId);
    setNotice('');
    setError('');
    try {
      const { data } = await api.post<EnableProviderResp>(API_ROUTES.admin.catalog.enableProvider(providerId));
      setNotice(`✅ تفعيل المزوّد: منتجات ${data.productsTouched} / باقات جديدة ${data.createdPackages} / متجاهلة ${data.skippedPackages}`);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'فشل التفعيل');
    } finally {
      setBusyId(null);
    }
  }

  function openPricing(providerId: string) {
    setOpenPriceFor(providerId);
    setMode('copy');
    setMarkupPercent('0');
    setFixedFee('0');
    setOnlyZero(false);
  }

  async function submitPricing() {
    if (!openPriceFor) return;
    setBusyId(openPriceFor);
    setError('');
    setNotice('');
    try {
      const payload: any =
        mode === 'markup'
          ? {
              mode: 'markup',
              markupPercent: Number(markupPercent) || 0,
              fixedFee: Number(fixedFee) || 0,
              overwriteZero: !onlyZero ? true : false,
            }
          : {
              mode: 'copy',
              overwriteZero: !onlyZero ? true : false,
            };

      const { data } = await api.post<RefreshPricesResp>(
        API_ROUTES.admin.catalog.refreshPrices(openPriceFor),
        payload
      );

      setNotice(
        `💵 تم تحديث الأسعار — محدَّث: ${data.updated} / بدون تطابق: ${data.skippedNoMatch} / بلا تكلفة: ${data.skippedNoCost} / دون FX: ${data.skippedNoFx} / إجمالي: ${data.totalCandidates}`
      );
      setOpenPriceFor(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'فشل تحديث الأسعار');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-4 md:p-6 text-text-primary">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">تفعيل كتالوج المزوّدين</h1>

        <a href="/admin/products/api-settings" className="btn btn-secondary">
          رجوع إلى إعدادات API
        </a>
      </div>

      {notice && (
        <div className="mb-3 p-3 rounded-md border border-green-500/40 bg-green-500/10 text-green-700">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-3 p-3 rounded-md border border-danger/40 bg-danger/10 text-danger">
          {error}
        </div>
      )}

      <div className="overflow-auto border border-border rounded-lg bg-bg-surface">
        <table className="min-w-[900px] w-full text-sm table">
          <thead className="bg-bg-surface-alt">
            <tr>
              <th className="px-3 py-2 font-medium border border-border text-right">الاسم</th>
              <th className="px-3 py-2 font-medium border border-border text-right">النوع</th>
              {/* <th className="px-3 py-2 font-medium border border-border text-right">الرابط</th> */}
              <th className="px-3 py-2 font-medium border border-border text-right">العمليات</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-text-secondary">
                  لا يوجد مزوّدون
                </td>
              </tr>
            )}

            {items.map((p) => (
              <tr key={p.id} className="border-t border-border bg-bg-surface hover:bg-primary/5">
                <td className="border border-border px-3 py-2 font-semibold">{p.name}</td>
                <td className="border border-border px-3 py-2 uppercase">{p.provider}</td>
                {/* <td className="border border-border px-3 py-2 text-xs text-text-secondary">{p.baseUrl ?? '—'}</td> */}
                <td className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleImport(p.id)}
                      disabled={busyId === p.id}
                      className="btn btn-primary disabled:opacity-50"
                    >
                      {busyId === p.id ? '...' : 'استيراد/تحديث الكتالوج'}
                    </button>

                    <button
                      onClick={() => handleEnableAllForProvider(p.id)}
                      disabled={busyId === p.id}
                      className="btn border border-border hover:bg-zinc-50 disabled:opacity-50"
                    >
                      {busyId === p.id ? '...' : 'تفعيل الكتالوج للمتجر'}
                    </button>

                    <button
                      onClick={() => openPricing(p.id)}
                      disabled={busyId === p.id}
                      className="btn bg-amber-500 text-white hover:brightness-110 disabled:opacity-50"
                    >
                      تحديث الأسعار
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {loading && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-text-secondary">
                  يحمل...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm text-text-secondary space-y-1">
        <div>• <b>استيراد/تحديث الكتالوج</b>: يحدّث الجداول المركزية (CatalogProduct/CatalogPackage).</div>
        <div>• <b>تفعيل الكتالوج للمتجر</b>: ينسخ كل المنتجات والباقات إلى متجر المشرف (Product/ProductPackage) دون تسعير.</div>
        <div>• <b>تحديث الأسعار</b>: ينسخ تكلفة الكتالوج (مع تحويل العملة إلى USD) إلى <code>basePrice</code>، مع خيار هامش.</div>
      </div>

      {openPriceFor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-xl bg-bg-surface text-text-primary shadow-lg border border-border">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold">تحديث الأسعار</h2>
              <button onClick={() => setOpenPriceFor(null)} className="text-text-secondary hover:text-text-primary">✕</button>
            </div>

            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm mb-1">الوضع</label>
                <select className="input w-full" value={mode} onChange={(e) => setMode(e.target.value as any)}>
                  <option value="copy">نسخ التكلفة (بعد التحويل إلى USD)</option>
                  <option value="markup">هامش (نسبة + رسم ثابت)</option>
                </select>
              </div>

              {mode === 'markup' && (
                <>
                  <div>
                    <label className="block text-sm mb-1">النسبة (%)</label>
                    <input
                      className="input w-full"
                      value={markupPercent}
                      onChange={(e) => setMarkupPercent(e.target.value)}
                      placeholder="مثال: 10"
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1">رسم ثابت (USD)</label>
                    <input
                      className="input w-full"
                      value={fixedFee}
                      onChange={(e) => setFixedFee(e.target.value)}
                      placeholder="مثال: 0.25"
                      inputMode="decimal"
                    />
                  </div>
                </>
              )}

              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyZero}
                  onChange={(e) => setOnlyZero(e.target.checked)}
                />
                <span className="text-sm">حدّث فقط الباقات التي سعرها الحالي = 0</span>
              </label>
            </div>

            <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
              <button onClick={() => setOpenPriceFor(null)} className="btn btn-secondary">إلغاء</button>
              <button onClick={submitPricing} disabled={busyId === openPriceFor} className="btn btn-primary disabled:opacity-50">
                {busyId === openPriceFor ? 'يجري التحديث...' : 'تنفيذ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
