'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import { useToast } from '@/context/ToastContext';

/** شكل استجابة الرفع من /admin/upload (Cloudinary وراء الكواليس) */
type UploadResponse = {
  url?: string;
  secure_url?: string;
  data?: {
    url?: string;
    secure_url?: string;
  };
};

type CatalogListItem = {
  id: string;
  name: string;
  imageUrl?: string | null;
  sourceProviderId?: string | null;
  externalProductId?: string | null;
  isActive: boolean;
  packagesCount?: number;
};

type ProviderRow = { id: string; name: string; provider: string };

/**
 * اختيار أول رابط صورة متاح من كائن الاستجابة بدون رمي خطأ مباشرة.
 * (أبسط من الدالة السابقة لتسهيل التشخيص)
 */
function pickUploadUrl(obj: any): string | null {
  if (!obj || typeof obj !== 'object') return null;
  return (
    obj.secure_url ||
    obj.secureUrl ||
    obj.url ||
    obj.imageUrl ||
    (obj.data && (
      obj.data.secure_url ||
      obj.data.secureUrl ||
      obj.data.url ||
      obj.data.imageUrl
    )) ||
    null
  );
}

// Toggleable debug (set localStorage.setItem('UPLOAD_DEBUG','1') to re-enable logging temporarily)
const isUploadDebug = () => typeof window !== 'undefined' && localStorage.getItem('UPLOAD_DEBUG') === '1';

export default function CatalogImagesPage() {
  const { show } = useToast();
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CatalogListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const providerMap = useMemo(() => {
    const m = new Map<string, { code: string; name: string }>();
    for (const p of providers) m.set(p.id, { code: (p.provider || '').toLowerCase(), name: p.name });
    return m;
  }, [providers]);
  const [pv, setPv] = useState<'all' | string>('all');

  async function load() {
    setLoading(true);
    try {
      const url = API_ROUTES.admin.catalog.listProducts(true, q);
      // ✅ نحدد نوع الاستجابة حتى ما يشتكي TS على data.items
      const { data } = await api.get<{ items: CatalogListItem[] }>(url);
      setItems(data?.items ?? []);
    } catch (err: any) {
      show(err?.response?.data?.message || err?.message || 'فشل تحميل الكتالوج');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<{ items: ProviderRow[] }>('/admin/providers/dev');
        setProviders(data?.items || []);
      } catch { setProviders([]); }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (pv === 'all') return items;
    return items.filter((p) => {
      const prov = providerMap.get(p.sourceProviderId || '')?.code || '';
      return prov.includes(pv);
    });
  }, [items, pv, providerMap]);

  const aggregates = useMemo(() => {
    const agg: Record<string, { products: number; packages: number }> = { all: { products: 0, packages: 0 } };
    for (const pr of providers) {
      const code = (pr.provider || '').toLowerCase();
      if (!agg[code]) agg[code] = { products: 0, packages: 0 };
    }
    for (const it of items) {
      const prov = providerMap.get(it.sourceProviderId || '')?.code || '';
      const pkg = it.packagesCount || 0;
      agg.all.products++; agg.all.packages += pkg;
      if (prov) {
        if (!agg[prov]) agg[prov] = { products: 0, packages: 0 };
        agg[prov].products++; agg[prov].packages += pkg;
      }
    }
    return agg;
  }, [items, providers, providerMap]);

  function onPickFileFor(id: string) {
    setTargetId(id);
    fileInputRef.current?.click();
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset
    if (!file || !targetId) return;

    setUpdatingId(targetId);
    try {
  const corr = `UPL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (isUploadDebug()) console.log('[UPLOAD][START]', { corr, name: file.name, size: file.size, type: file.type, targetId });
      // 1) رفع الصورة (multipart)
      const form = new FormData();
      form.append('file', file);
      form.append('correlationId', corr);
      // Use fetch to avoid forcing multipart boundary header manually
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
  const upRes = await fetch(API_ROUTES.admin.upload, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Upload-Correlation': corr,
        },
        body: form,
      });
  if (isUploadDebug()) console.log('[UPLOAD][RESP_META]', corr, upRes.status, upRes.headers.get('content-type'));
  // اعتبر 200 و 201 نجاحاً
  if (upRes.status !== 200 && upRes.status !== 201) {
        if (upRes.status === 401 || upRes.status === 403) throw new Error('جلسة منتهية، يرجى تسجيل الدخول');
        if (upRes.status === 413) throw new Error('الصورة كبيرة جدًا');
        let p: any = null; try { p = await upRes.json(); } catch {}
        const msg = p?.message || p?.error || 'فشل رفع الملف…';
        if (p?.code === 'cloudinary_bad_credentials') throw new Error('إعدادات Cloudinary غير صحيحة');
        throw new Error(msg);
      }
  let up: UploadResponse | null = null;
  // DEBUG: طباعة الاستجابة الخام قبل التحويل (أزلها لاحقاً)
      try {
        const raw = await upRes.clone().text();
        if (isUploadDebug()) console.log('[UPLOAD][RAW]', corr, upRes.status, 'len='+raw.length, raw);
      } catch {}
      try { up = await upRes.json(); } catch (parseErr) { if (isUploadDebug()) console.warn('[UPLOAD][PARSE_ERR]', corr, parseErr); up = null; }
      if (isUploadDebug()) console.log('[UPLOAD][JSON]', corr, up);
  // 2) استخراج الرابط (نمرّر الكائن كلياً لا .data فقط)
  const picked = pickUploadUrl(up);
      if (!picked) {
        if (isUploadDebug()) console.warn('[UPLOAD][MISS]', corr, 'object بدون رابط معروف', up);
        throw new Error('لم يتم استلام رابط الصورة');
      }
      if (isUploadDebug()) console.log('[UPLOAD][URL]', corr, picked);
  const url = picked;

      // 3) تعيين الصورة على منتج الكتالوج + نشرها للمتجر إن كانت ناقصة
  // PATCH (could also use PUT; backend accepts both for image link) with propagate:true
  await api.patch(API_ROUTES.admin.catalog.setProductImage(targetId), { imageUrl: url, propagate: true });

      // 4) تحديث الواجهة محليًا
  setItems((prev) => prev.map((it) => (it.id === targetId ? { ...it, imageUrl: url } : it)));
  if (isUploadDebug()) console.log('[UPLOAD][DONE]', corr, { targetId, url });
  show('تم تحديث صورة المنتج ✓');
    } catch (err: any) {
      if (isUploadDebug()) console.error('[UPLOAD][ERROR]', err);
      show(err?.response?.data?.message || err?.message || 'فشل رفع/تحديث الصورة');
    } finally {
      setUpdatingId(null);
      setTargetId(null);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-semibold">إدارة صور الكتالوج</h1>
          <div className="flex items-center gap-2">
            <input
              className="input w-64"
              placeholder="ابحث بالاسم…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
            />
            <button className="btn btn-primary" onClick={load} disabled={loading}>
              {loading ? 'يحمّل...' : 'بحث/تحديث'}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { key: 'all', label: 'الكل' },
            ...providers.map((p) => ({ key: (p.provider || '').toLowerCase(), label: p.name })),
          ].map((b) => {
            const ag = aggregates[b.key] || { products: 0, packages: 0 };
            return (
              <button
                key={b.key}
                onClick={() => setPv(b.key)}
                className={`px-3 py-1.5 rounded-full text-sm border flex flex-col items-center leading-tight ${pv === b.key ? 'bg-black text-white border-black' : 'hover:bg-zinc-100'}`}
              >
                <span>{b.label} ({ag.products})</span>
                <span className={`text-[10px] ${pv === b.key ? 'text-white/80' : 'text-zinc-500'}`}>باقات {ag.packages}</span>
              </button>
            );
          })}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((p) => (
          <div key={p.id} className="rounded-xl border bg-white p-3 flex gap-3 items-center">
            <div className="h-14 w-14 rounded-lg bg-zinc-100 overflow-hidden flex items-center justify-center">
              {(() => {
                const cleanUrl = p.imageUrl && p.imageUrl.includes('via.placeholder.com') ? null : p.imageUrl;
                return cleanUrl ? (
                  <img
                    src={cleanUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      if (!img.dataset.fallback) {
                        img.dataset.fallback = '1';
                        img.src = '/images/placeholder.png';
                      }
                    }}
                  />
                ) : (
                  <span className="text-2xl">📦</span>
                );
              })()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{p.name}</div>
              <div className="text-xs text-zinc-500">
                {p.packagesCount != null ? `عدد الباقات: ${p.packagesCount}` : '—'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-secondary hover:bg-gray-400"
                onClick={() => onPickFileFor(p.id)}
                disabled={updatingId === p.id}
              >
                {updatingId === p.id ? 'يرفع...' : p.imageUrl ? 'تغيير الصورة' : 'رفع صورة'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && !loading && (
        <div className="text-sm text-zinc-500 mt-6">لا توجد منتجات كتالوج مطابقة.</div>
      )}
    </div>
  );
}
