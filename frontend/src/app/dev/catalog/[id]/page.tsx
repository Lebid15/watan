 'use client';

import { useEffect, useMemo, useState } from 'react';
import api from '@/utils/api';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/context/ToastContext';

type CatalogPackage = {
  id: string;
  name: string;
  publicCode: string;
  costPrice?: string | null;
  currencyCode?: string | null;
  externalPackageId?: string | null;
  isActive: boolean;
};

type ListResp = CatalogPackage[] | { items?: CatalogPackage[] } | unknown;

function normalizePkgs(data: ListResp): CatalogPackage[] {
  if (Array.isArray(data)) return data as CatalogPackage[];
  if (data && typeof data === 'object' && 'items' in (data as any)) {
    return ((data as any).items ?? []) as CatalogPackage[];
  }
  return [];
}

// مكون عميل: لا يجب أن يكون async وإلا سيعامله Next كـ Server Component ويكسر الـ hooks
// ملاحظة: مولد الأنواع لدى Next (حالياً) كان يتوقع params كـ Promise بالصيغة القديمة.
// نستخدم wrapper لتجنب فشل التحقق: نستقبل props كـ any ثم نستخرج id بأمان.
export default function CatalogProductDetails(props: any) {
  const id: string = props?.params?.id || '';
  const [pkgs, setPkgs] = useState<CatalogPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { show } = useToast();

  const sp = useSearchParams();
  const pv = (sp.get('pv') ?? 'all') as 'all' | 'znet' | 'barakat';

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get(`/admin/catalog/products/${id}/packages`);
      const data: any = res.data;
      if (data?.error) setLoadError(data.error as string);
      setPkgs(normalizePkgs(data));
    } catch (e: any) {
      setLoadError(e?.response?.data?.message || e?.message || 'فشل جلب الباقات');
      setPkgs([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleEnableAllForProduct() {
    setEnabling(true);
    try {
      const { data } = await api.post(`/admin/catalog/products/${id}/enable-all`);
      const created = Number((data as any)?.createdPackages ?? 0);
      const skipped = Number((data as any)?.skippedPackages ?? 0);
      const total = Number((data as any)?.totalFromCatalog ?? 0);
      show(`✅ تم التفعيل: جديدة ${created} / متجاهلة ${skipped} / المجموع ${total}`);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'فشل التفعيل';
      show(`⚠️ ${msg}`);
    } finally {
      setEnabling(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  const pvLabel = useMemo(() => {
    if (pv === 'znet') return 'ZNET';
    if (pv === 'barakat') return 'Barakat';
    return 'الكل';
  }, [pv]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">باقات المنتج</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded-full border bg-white">{pvLabel}</span>
          <a href={`/dev/catalog?pv=${encodeURIComponent(pv)}`} className="text-sm text-blue-600 hover:underline">
            رجوع للكتالوج
          </a>
        </div>
      </div>

      {/* زر تفعيل كل الباقات لهذا المنتج */}
      <div>
        <button
          onClick={handleEnableAllForProduct}
          disabled={enabling}
          className={`px-4 py-2 rounded-lg text-white ${enabling ? 'bg-zinc-400' : 'bg-black hover:opacity-90'}`}
        >
          {enabling ? 'جارٍ التفعيل…' : 'تفعيل كل باقات هذا المنتج للمتجر'}
        </button>
      </div>

      {loadError && !loading && (
        <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-700 text-sm">
          ⚠️ {loadError}
          <button onClick={load} className="ml-3 underline">إعادة المحاولة</button>
        </div>
      )}

      <div className="rounded-xl border bg-white overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="text-start px-3 py-2">الاسم</th>
              <th className="text-start px-3 py-2">publicCode</th>
              <th className="text-start px-3 py-2">التكلفة</th>
              <th className="text-start px-3 py-2">العملة</th>
              <th className="text-start px-3 py-2">extId</th>
              <th className="text-start px-3 py-2">الحالة</th>
            </tr>
          </thead>
          <tbody>
            {pkgs.map((x) => (
              <tr key={x.id} className="border-t">
                <td className="px-3 py-2">{x.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{x.publicCode}</td>
                <td className="px-3 py-2">{x.costPrice ?? '-'}</td>
                <td className="px-3 py-2">{x.currencyCode ?? '-'}</td>
                <td className="px-3 py-2 text-xs text-zinc-600">{x.externalPackageId ?? '-'}</td>
                <td className="px-3 py-2">{x.isActive ? 'مفعل' : 'معطل'}</td>
              </tr>
            ))}
            {pkgs.length === 0 && !loading && !loadError && (
              <tr><td className="px-3 py-4 text-zinc-500" colSpan={6}>لا توجد باقات</td></tr>
            )}
          </tbody>
        </table>
      </div>

  {loading && <div className="text-sm text-zinc-600">جارٍ التحميل…</div>}
    </div>
  );
}
