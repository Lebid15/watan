'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import api, { API_ROUTES } from '@/utils/api';
import toast from 'react-hot-toast';
import { getDecimalDigits, clampPriceDecimals, priceInputStep } from '@/utils/pricingFormat';

interface UpdatePricesResponse {
  packageId: string;
  capital: number;
  prices: { id: string | null; groupId: string; groupName: string; price: number }[];
}

interface PriceGroup { id: string; name: string; }
interface PackagePrice { id: string | null; price: number; groupId: string; groupName: string; }
interface ProductPackage { id: string; productId: string; name: string; capital: number; prices: PackagePrice[]; type?: 'fixed' | 'unit'; }
interface ProductDTO {
  id: string; name: string;
  packages: { id: string; name: string; capital?: number; basePrice?: number; prices?: any[]; type?: 'fixed' | 'unit'; }[];
}
type BulkMode = 'percent' | 'fee';

const round2 = (n: number) => Math.round(n * 100) / 100;

/* =========================================================
   Helpers
========================================================= */
function toNumberSafe(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
const format2 = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
};

function extractGroupId(p: any): string | null {
  return (
    p?.groupId ??
    p?.priceGroupId ??
    p?.price_group_id ??
    p?.price_groupId ??
    p?.group?.id ??
    p?.priceGroup?.id ??
    null
  );
}
function extractGroupName(p: any): string {
  return (
    p?.groupName ??
    p?.priceGroupName ??
    p?.group?.name ??
    p?.priceGroup?.name ??
    ''
  );
}
function normalizeOnePrice(p: any): PackagePrice | null {
  const gid = extractGroupId(p);
  if (!gid) return null;
  return {
    id: p?.id ?? null,
    groupId: String(gid),
    groupName: extractGroupName(p),
    price: toNumberSafe(p?.price, 0),
  };
}
function normalizePrices(arr: any[] | undefined | null): PackagePrice[] {
  if (!Array.isArray(arr)) return [];
  const list: PackagePrice[] = [];
  for (const raw of arr) {
    const norm = normalizeOnePrice(raw);
    if (norm) list.push(norm);
  }
  return list;
}
function mergePricesIntoPackage(pkg: ProductPackage, incoming: PackagePrice[]): ProductPackage {
  if (!incoming.length) return pkg;
  const map = new Map(pkg.prices.map(p => [p.groupId, { ...p }]));
  for (const np of incoming) {
    map.set(np.groupId, { ...(map.get(np.groupId) ?? {}), ...np });
  }
  return { ...pkg, prices: Array.from(map.values()) };
}


/* ==========================
   ComboBox + Modal (كما هي)
========================== */
function ComboBox({
  label, value, onChange,
  options, placeholder = 'اختر…', allLabel, widthClass = 'w-full'
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  allLabel?: string;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const shown = useMemo(() => {
    const base = allLabel ? [{ value: 'ALL', label: allLabel }, ...options] : options;
    const s = q.trim().toLowerCase();
    if (!s) return base;
    return base.filter(o => o.label.toLowerCase().includes(s));
  }, [q, options, allLabel]);

  const current = useMemo(() => {
    if (value === 'ALL' && allLabel) return allLabel;
    return options.find(o => o.value === value)?.label || '';
  }, [value, options, allLabel]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!open) return;
      const t = e.target as Node;
      if (btnRef.current && !btnRef.current.contains(t)) {
        const panel = document.getElementById(`cb-panel-${label}`);
        if (panel && !panel.contains(t)) setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, label]);

  return (
    <div className={`relative ${widthClass}`}>
      <div className="text-sm mb-1">{label}</div>
      <button
        ref={btnRef}
        type="button"
        className="input w-full flex items-center justify-between text-right"
        onClick={() => setOpen(v => !v)}
      >
        <span className="truncate">{current || placeholder}</span>
        <span>▾</span>
      </button>

      {open && (
        <div
          id={`cb-panel-${label}`}
          className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-bg-surface shadow-lg"
        >
          <div className="p-2 border-b border-border">
            <input
              className="input w-full"
              placeholder="ابحث هنا…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-64 overflow-auto py-1">
            {shown.map(opt => (
              <div
                key={opt.value}
                className={[
                  'px-3 py-2 cursor-pointer hover:bg-primary/10',
                  opt.value === value ? 'bg-primary/15 font-medium' : ''
                ].join(' ')}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                {opt.label}
              </div>
            ))}
            {shown.length === 0 && <div className="px-3 py-3 text-sm text-text-secondary">لا نتائج</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Modal({
  title, children, onClose, actions
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-[rgba(0,0,0,.5)] p-4">
      <div className="w-full max-w-3xl rounded-xl bg-bg-surface text-text-primary shadow-xl border border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary">✕</button>
        </div>
        <div className="p-4">{children}</div>
        <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
          {actions}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* =========================================================
   الصفحة
========================================================= */
export default function PriceGroupsPage() {
  const [packages, setPackages] = useState<ProductPackage[]>([]);
  const [priceGroups, setPriceGroups] = useState<PriceGroup[]>([]);
  const [productsList, setProductsList] = useState<{ id: string; name: string; packageIds: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // فلتر المنتج (ALL = عرض كل المنتجات)
  const [filterProductId, setFilterProductId] = useState<'ALL' | string>('ALL');

  const timersRef = useRef<Record<string, any>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkGroupId, setBulkGroupId] = useState<'ALL' | string>('ALL');
  const [bulkProductId, setBulkProductId] = useState<'ALL' | string>('ALL');
  const [bulkMode, setBulkMode] = useState<BulkMode>('percent');
  const [bulkValue, setBulkValue] = useState<string>('0');

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string>('');

  const packagesRef = useRef<ProductPackage[]>([]);
  useEffect(() => { packagesRef.current = packages; }, [packages]);

  // 🛡️ مسودات إدخال لمنع التقريب أثناء الكتابة
  const [capitalDraft, setCapitalDraft] = useState<Record<string, string>>({});
  const [priceDraft, setPriceDraft] = useState<Record<string, Record<string, string>>>({});

  // 🛡️ حراسة السباق (إبقاءها إن أردت لاحقاً)
  const writeSeqRef = useRef(0);
  const lastAppliedSeqRef = useRef(0);
  const initialPricesMergedRef = useRef(false);

  useEffect(() => { fetchData(); }, []);

  // ——— جلب أسعار باقة واحدة من الـ API ودمجها في الحالة ———
  async function refreshOnePackagePrices(packageId: string, seq?: number) {
    try {
      const url = `${API_ROUTES.products.base}/packages/prices`;
      const r = await api.post<any[]>(url, { packageIds: [packageId] });
      const rows = Array.isArray(r.data) ? r.data : [];

      const byGroup = new Map<string, PackagePrice>();
      for (const row of rows) {
        const pid: string | undefined =
          row?.packageId ?? row?.package_id ?? row?.pkgId ?? row?.productPackageId;
        if (!pid || pid !== packageId) continue;

        if (Array.isArray(row?.prices)) {
          for (const p of normalizePrices(row.prices)) {
            byGroup.set(p.groupId, p);
          }
        } else {
          const one = normalizeOnePrice(row);
          if (one) byGroup.set(one.groupId, one);
        }
      }

      const list = Array.from(byGroup.values());
      if (seq && seq < lastAppliedSeqRef.current) return;
      if (seq) lastAppliedSeqRef.current = seq;

      if (!list.length) return;
      setPackages(prev =>
        prev.map(pkg => (pkg.id === packageId ? { ...pkg, prices: list } : pkg))
      );
      // بعد التحديث من السيرفر نلغي المسودات لهذه الباقة كي تظهر منسقة
      setPriceDraft(prev => {
        const { [packageId]: _, ...rest } = prev;
        return rest;
      });
    } catch {}
  }

  // ——— محاولة جلب أسعار كل الباقات مرة واحدة (أثناء التحميل الأولي) ———
  async function tryFetchPackagePricesAndMerge(currentPkgs: ProductPackage[]) {
    try {
      const PKG_PRICES_URL = `${API_ROUTES.products.base}/packages/prices`;
      const ids = currentPkgs.map(p => p.id);
      if (!ids.length) return currentPkgs;

      const r = await api.post<any[]>(PKG_PRICES_URL, { packageIds: ids });
      const rows = Array.isArray(r.data) ? r.data : [];

      const map = new Map<string, Map<string, PackagePrice>>();
      for (const row of rows) {
        const pid: string | undefined =
          row?.packageId ?? row?.package_id ?? row?.pkgId ?? row?.productPackageId;
        if (!pid) continue;

        if (!map.has(pid)) map.set(pid, new Map<string, PackagePrice>());
        const inner = map.get(pid)!;

        if (Array.isArray(row?.prices)) {
          for (const p of normalizePrices(row.prices)) inner.set(p.groupId, p);
        } else {
          const one = normalizeOnePrice(row);
          if (one) inner.set(one.groupId, one);
        }
      }

      const replaced = currentPkgs.map(pkg => {
        const inner = map.get(pkg.id);
        if (!inner) return pkg;
        const incoming = Array.from(inner.values());
        return { ...pkg, prices: incoming };
      });

      return replaced;
    } catch {
      return currentPkgs;
    }
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get<ProductDTO[]>(API_ROUTES.products.base);
      const data = res.data || [];
      const pList: { id: string; name: string; packageIds: string[] }[] = [];
      let allPkgs: ProductPackage[] = [];

    for (const prod of data) {
        const pkgIds: string[] = [];
        for (const pkg of (prod.packages ?? [])) {
          const capital = toNumberSafe(pkg?.basePrice ?? pkg?.capital ?? 0);
          const prices = normalizePrices(pkg?.prices);
          allPkgs.push({ id: pkg.id, productId: prod.id, name: pkg.name, capital, prices, type: pkg.type });
          pkgIds.push(pkg.id);
        }
        pList.push({ id: prod.id, name: prod.name, packageIds: pkgIds });
      }

      const groupsRes = await api.get<PriceGroup[]>(API_ROUTES.products.priceGroups);
      const groups = groupsRes.data || [];

      if (!initialPricesMergedRef.current) {
        allPkgs = await tryFetchPackagePricesAndMerge(allPkgs);
        initialPricesMergedRef.current = true;
      }

      setProductsList(pList);
      setPackages(allPkgs);
      setPriceGroups(groups);
      setError('');
      // نظّف أي مسودات قديمة لأنها قد لا تطابق البيانات الجديدة
      setCapitalDraft({});
      setPriceDraft({});
    } catch (err) {
      console.error(err);
      setError('فشل في جلب البيانات من السيرفر');
    } finally {
      setLoading(false);
    }
  };

  // —— حفظ تلقائي مؤجّل لكل باقة —— 
  const queueSave = (packageId: string) => {
    if (timersRef.current[packageId]) clearTimeout(timersRef.current[packageId]);
    timersRef.current[packageId] = setTimeout(async () => {
      const pkg = packagesRef.current.find((p) => p.id === packageId);
      if (!pkg) return;

      try {
        setSavingMap((m) => ({ ...m, [packageId]: true }));

        const payload = {
          capital: pkg.capital,
          prices: pkg.prices.map((p) => ({ groupId: p.groupId, price: p.price })),
        };

        const { data: updated } = await api.put<UpdatePricesResponse>(
          `${API_ROUTES.products.base}/packages/${pkg.id}/prices`,
          payload
        );

        const list: PackagePrice[] = Array.isArray(updated?.prices)
          ? updated.prices.map((p) => {
              const n = Number(p?.price);
              return {
                id: p?.id ?? null,
                groupId: String(p?.groupId),
                groupName: p?.groupName ?? '',
                price: Number.isFinite(n) ? n : 0,
              };
            })
          : [];

        setPackages((prev) =>
          prev.map((p) => (p.id === packageId ? { ...p, capital: updated.capital, prices: list } : p))
        );
        // بعد الحفظ الناجح، احذف المسودات لهذه الباقة ليظهر التنسيق 0.00
        setCapitalDraft(prev => {
          const { [packageId]: _, ...rest } = prev;
          return rest;
        });
        setPriceDraft(prev => {
          const { [packageId]: _, ...rest } = prev;
          return rest;
        });

      } catch (err) {
        console.error('حفظ تلقائي فشل:', err);
        toast.error(`تعذّر حفظ "${pkg?.name ?? 'الباقة'}"`);
      } finally {
        setSavingMap((m) => ({ ...m, [packageId]: false }));
      }
    }, 500);
  };

  /* ========= تحرير رأس المال: استخدام مسودة ========= */
  const onCapitalFocus = (packageId: string) => {
    setCapitalDraft((d) => ({
      ...d,
      [packageId]: d[packageId] ?? format2(packages.find(p => p.id === packageId)?.capital ?? 0),
    }));
  };
  const onCapitalChange = (packageId: string, value: string) => {
    // لا نحفظ هنا؛ فقط نحدّث المسودة كما هي
    setCapitalDraft((d) => ({ ...d, [packageId]: value }));
  };
  const onCapitalBlur = (packageId: string) => {
    const raw = (capitalDraft[packageId] ?? '').toString().replace(',', '.').trim();
    const num = raw === '' || raw === '.' || raw === '-' ? 0 : Number(parseFloat(raw).toFixed(2));
    setPackages(prev => prev.map(pkg => (pkg.id === packageId ? { ...pkg, capital: num } : pkg)));
    queueSave(packageId);
    // نترك التنسيق الافتراضي يتولاه العرض (نزيل المسودة)
    setCapitalDraft((d) => {
      const { [packageId]: _, ...rest } = d;
      return rest;
    });
  };
  const onCapitalKeyDown = (packageId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  /* ========= تحرير سعر مجموعة: استخدام مسودة ========= */
  const onPriceFocus = (packageId: string, groupId: string, current?: number) => {
    setPriceDraft((d) => {
      const inner = d[packageId] ?? {};
      return {
        ...d,
        [packageId]: { ...inner, [groupId]: inner[groupId] ?? format2(current ?? 0) },
      };
    });
  };
  const onPriceChange = (packageId: string, groupId: string, value: string) => {
    setPriceDraft((d) => {
      const inner = d[packageId] ?? {};
      return { ...d, [packageId]: { ...inner, [groupId]: value } };
    });
  };
  const onPriceBlur = (packageId: string, groupId: string) => {
    const raw = (priceDraft[packageId]?.[groupId] ?? '').toString().replace(',', '.').trim();
    const num = raw === '' || raw === '.' || raw === '-' ? 0 : Number(parseFloat(raw).toFixed(2));

    setPackages(prev =>
      prev.map(pkg =>
        pkg.id === packageId
          ? {
              ...pkg,
              prices: pkg.prices.find(p => p.groupId === groupId)
                ? pkg.prices.map(p => (p.groupId === groupId ? { ...p, price: num } : p))
                : [...pkg.prices, { id: null, groupId, groupName: '', price: num }],
            }
          : pkg
      )
    );

    queueSave(packageId);

    // نظّف المسودة لهذه الخلية ليظهر 0.00
    setPriceDraft((d) => {
      const inner = d[packageId] ?? {};
      const { [groupId]: _, ...restInner } = inner;
      return { ...d, [packageId]: restInner };
    });
  };
  const onPriceKeyDown = (packageId: string, groupId: string, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  // —— تطبيق التسعير الجماعي —— 
  const applyBulk = async () => {
    const val = Number(bulkValue);
    if (!Number.isFinite(val)) { toast.error('أدخل قيمة صحيحة'); return; }

    const targetPkgIds: string[] =
      bulkProductId === 'ALL'
        ? packages.map((p) => p.id)
        : (productsList.find((p) => p.id === bulkProductId)?.packageIds ?? []);

    if (!targetPkgIds.length) { toast('لا توجد باقات مطابقة'); return; }

    const targetGroupIds =
      bulkGroupId === 'ALL' ? priceGroups.map((g) => g.id) : [bulkGroupId];

    setPackages((prev) => {
      const byId = new Map(prev.map(p => [p.id, p]));
      for (const pid of targetPkgIds) {
        const pkg = byId.get(pid);
        if (!pkg) continue;

        const pricesMap = new Map(pkg.prices.map(p => [p.groupId, { ...p }]));

        for (const gid of targetGroupIds) {
          const base = pkg.capital;
          let newPrice = base;
          if (bulkMode === 'percent') newPrice = base * (1 + val / 100);
          else newPrice = base + val;

          const existing = pricesMap.get(gid);
          if (existing) {
            existing.price = round2(newPrice);
            pricesMap.set(gid, existing);
          } else {
            pricesMap.set(gid, { id: null, groupId: gid, groupName: '', price: round2(newPrice) });
          }
        }

        byId.set(pid, { ...pkg, prices: Array.from(pricesMap.values()) });
      }
      return Array.from(byId.values());
    });

    // صف الحفظ لكل باقة
    for (const pid of targetPkgIds) queueSave(pid);

    setBulkOpen(false);
    toast.success('تم تطبيق التسعير الجماعي وحفظه تلقائيًا ✅');
  };

  // —— حذف مجموعة —— 
  const deleteGroup = async () => {
    if (!deleteGroupId) return;
    try {
      await api.delete(`${API_ROUTES.products.priceGroups}/${deleteGroupId}`);
      toast.success('تم حذف المجموعة بنجاح ✅');
      setDeleteOpen(false);
      setDeleteGroupId('');
      await fetchData();
    } catch (err) {
      console.error(err);
      toast.error('فشل حذف المجموعة ❌');
    }
  };

  // —— خيارات الكومبوبوكس —— 
  const priceGroupOptions = useMemo(
    () => priceGroups.map(g => ({ value: g.id, label: g.name })),
    [priceGroups]
  );
  const productOptions = useMemo(
    () => productsList.map(p => ({ value: p.id, label: p.name })),
    [productsList]
  );
  // قائمة المنتجات المفلترة حسب اختيار المستخدم
  const filteredProductsList = useMemo(
    () => (filterProductId === 'ALL' ? productsList : productsList.filter(p => p.id === filterProductId)),
    [productsList, filterProductId]
  );

  if (loading) return <div className="p-4 text-text-primary">جارٍ التحميل...</div>;
  if (error) return <div className="p-4 text-danger">{error}</div>;

  // Assumption: Unit price overrides are managed relative to the FIRST price group (primary group) unless UI extended later.
  const primaryGroupId = priceGroups[0]?.id; // may be undefined if no groups
  const DECIMAL_DIGITS = getDecimalDigits();

  return (
    <div className="space-y-4">
      {/* شريط الإجراءات */}
      <div className="flex items-center justify-start gap-3 flex-wrap">
        <button onClick={() => setBulkOpen(true)} className="btn btn-primary">
          ⚙️ تسعير جماعي
        </button>

        <button
          onClick={async () => {
            const name = prompt('أدخل اسم مجموعة أسعار جديدة:');
            if (!name || !name.trim()) return;
            try {
              await api.post(API_ROUTES.products.priceGroups, { name });
              toast.success('تمت إضافة المجموعة ✅');
              fetchData();
            } catch {
              toast.error('فشل إضافة المجموعة ❌');
            }
          }}
          className="btn"
        >
          + مجموعة جديدة
        </button>

        <button
          onClick={() => setDeleteOpen(true)}
          className="btn bg-danger text-text-inverse hover:brightness-110"
        >
          🗑 حذف مجموعة
        </button>
        {/* فلتر المنتج */}
        <div className="min-w-[240px]">
          <ComboBox
            label="فلتر المنتج"
            value={filterProductId}
            onChange={(v) => setFilterProductId(v as any)}
            options={productOptions}
            allLabel="الكل"
            placeholder="اختر المنتج"
          />
        </div>
      </div>

      {/* جداول منفصلة لكل منتج */}
      <div className="space-y-10">
  {filteredProductsList.map(prod => {
          const prodPkgs = packages.filter(p => p.productId === prod.id);
          if (!prodPkgs.length) return null;
          return (
            <div key={prod.id} className="border border-border rounded-xl overflow-hidden bg-bg-surface">
              <div className="px-4 py-3 bg-bg-surface-alt flex items-center justify-between">
                <h3 className="font-bold text-text-primary">{prod.name}</h3>
                <span className="text-xs text-text-secondary">عدد الباقات: {prodPkgs.length}</span>
              </div>
              <div className="table-wrap overflow-auto">
                <table className="table min-w-[1000px]">
                  <thead>
                    <tr>
                      <th>اسم الباقة</th>
                      <th>رأس المال (USD)</th>
                      {priceGroups.map((group) => (
                        <th key={group.id}>{group.name}</th>
                      ))}
                      {prodPkgs.some(p => p.type === 'unit') && (
                        <th>Unit price</th>
                      )}
                      <th className="w-28">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodPkgs.map(pkg => (
                      <tr key={pkg.id} className="hover:bg-primary/5">
                        <td className="font-medium">{pkg.name}</td>
                        <td>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={capitalDraft[pkg.id] ?? format2(pkg.capital)}
                            onFocus={() => onCapitalFocus(pkg.id)}
                            onChange={(e) => onCapitalChange(pkg.id, e.target.value)}
                            onBlur={() => onCapitalBlur(pkg.id)}
                            onKeyDown={(e) => onCapitalKeyDown(pkg.id, e)}
                            className="input w-32"
                          />
                        </td>
                        {priceGroups.map(group => {
                          const price = pkg.prices.find(p => p.groupId === group.id)?.price ?? 0;
                          const draft = priceDraft[pkg.id]?.[group.id];
                          return (
                            <td key={group.id}>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={draft ?? format2(price)}
                                onFocus={() => onPriceFocus(pkg.id, group.id, price)}
                                onChange={(e) => onPriceChange(pkg.id, group.id, e.target.value)}
                                onBlur={() => onPriceBlur(pkg.id, group.id)}
                                onKeyDown={(e) => onPriceKeyDown(pkg.id, group.id, e)}
                                className="input w-32"
                              />
                            </td>
                          );
                        })}
                        {prodPkgs.some(p => p.type === 'unit') && (
                          <td>
                            {pkg.type === 'unit' && primaryGroupId ? (
                              <UnitPriceOverrideCell
                                key={pkg.id + '-unit'}
                                packageId={pkg.id}
                                groupId={primaryGroupId}
                                digits={DECIMAL_DIGITS}
                              />
                            ) : <span className="text-text-secondary">—</span>}
                          </td>
                        )}
                        <td className="text-sm text-center">
                          {savingMap[pkg.id] ? (
                            <span className="text-warning">يحفظ…</span>
                          ) : (
                            <span className="text-green-600">✓ محفوظ</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* نافذة التسعير الجماعي */}
      {bulkOpen && (
        <Modal
          title="تسعير جماعي"
          onClose={() => setBulkOpen(false)}
          actions={
            <>
              <button onClick={() => setBulkOpen(false)} className="btn btn-secondary">إلغاء</button>
              <button onClick={applyBulk} className="btn btn-primary">تطبيق</button>
            </>
          }
        >
          <div className="grid md:grid-cols-2 gap-4">
            <ComboBox
              label="مجموعة الأسعار"
              value={bulkGroupId}
              onChange={(v) => setBulkGroupId(v as any)}
              options={priceGroupOptions}
              allLabel="الكل"
            />
            <ComboBox
              label="المنتج"
              value={bulkProductId}
              onChange={(v) => setBulkProductId(v as any)}
              options={productOptions}
              allLabel="كل المنتجات"
            />
            <div>
              <div className="text-sm mb-1">الطريقة</div>
              <select
                className="input w-full"
                value={bulkMode}
                onChange={(e) => setBulkMode(e.target.value as BulkMode)}
              >
                <option value="percent">نسبة مئوية % (على رأس المال)</option>
                <option value="fee">مبلغ ثابت $ (يُضاف على رأس المال)</option>
              </select>
            </div>
            <div>
              <div className="text-sm mb-1">{bulkMode === 'percent' ? 'القيمة (%)' : 'القيمة ($)'}</div>
              <input
                className="input w-full"
                inputMode="decimal"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder={bulkMode === 'percent' ? 'مثال: 5' : 'مثال: 0.25'}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* نافذة حذف مجموعة */}
      {deleteOpen && (
        <Modal
          title="حذف مجموعة أسعار"
          onClose={() => setDeleteOpen(false)}
          actions={
            <>
              <button onClick={() => setDeleteOpen(false)} className="btn btn-secondary">إلغاء</button>
              <button
                onClick={deleteGroup}
                className="btn bg-danger text-text-inverse hover:brightness-110"
                disabled={!deleteGroupId}
              >
                حذف
              </button>
            </>
          }
        >
          <ComboBox
            label="اختر المجموعة"
            value={deleteGroupId}
            onChange={(v) => setDeleteGroupId(v)}
            options={priceGroupOptions}
            placeholder="اختر المجموعة…"
          />
          <div className="text-sm text-text-secondary mt-3">
            سيتم حذف المجموعة وجميع أسعارها المرتبطة بالباقات.
          </div>
        </Modal>
      )}
    </div>
  );
}

/* =========================================================
   Unit Price Override Cell
   - Shows editable field for unit packages only (using primary group)
   - PUT /api/admin/price-groups/:groupId/package-prices/:packageId/unit { unitPrice }
   - DELETE /api/admin/price-groups/:groupId/package-prices/:packageId/unit
   - After mutation re-fetches current override via:
     GET /api/admin/products/price-groups/:groupId/package-prices?packageId=...
========================================================= */
interface UnitOverrideFetchItem { packageId: string; unitPrice: number; }
interface UnitOverrideFetchResponse { data?: UnitOverrideFetchItem[] | UnitOverrideFetchItem | null; unitPrice?: number; packageId?: string; }

function UnitPriceOverrideCell({ packageId, groupId, digits }: { packageId: string; groupId: string; digits: number; }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [overrideValue, setOverrideValue] = useState<number | null>(null); // null => no override
  const inputRef = useRef<HTMLInputElement | null>(null);
  const step = priceInputStep(digits);

  // Fetch current override
  const fetchOverride = async () => {
    try {
      const url = `/api/admin/products/price-groups/${groupId}/package-prices?packageId=${packageId}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) return; // silent
      const json: any = await res.json().catch(() => ({}));
      // Flexible: server might return {unitPrice} or array
      let found: number | null = null;
      if (typeof json?.unitPrice === 'number') found = json.unitPrice;
      else if (Array.isArray(json?.data)) {
        const item = json.data.find((x: any) => String(x?.packageId) === packageId);
        if (item && typeof item.unitPrice === 'number') found = item.unitPrice;
      } else if (json && typeof json === 'object' && typeof json.unitPrice === 'number') {
        found = json.unitPrice;
      }
      setOverrideValue(found);
    } catch { /* ignore */ }
  };

  useEffect(() => { fetchOverride(); }, [packageId, groupId]);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  function startEdit() {
    setDraft(overrideValue != null ? String(overrideValue) : '');
    setEditing(true);
  }

  function validateDraft(val: string): number | null {
    if (!val.trim()) return null; // treat empty as invalid until user types
    const normalized = val.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
    const num = Number(normalized);
    if (!Number.isFinite(num) || num <= 0) return null;
    // clamp decimals
    return Number(clampPriceDecimals(num, digits));
  }

  async function save() {
    const parsed = validateDraft(draft);
    if (parsed == null) { toast.error('قيمة غير صالحة'); return; }
    const prev = overrideValue;
    setOverrideValue(parsed); // optimistic
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/price-groups/${groupId}/package-prices/${packageId}/unit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitPrice: parsed })
      });
      if (!res.ok) {
        let msg = 'فشل الحفظ';
        try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
        setOverrideValue(prev);
        toast.error(msg);
      } else {
        toast.success('تم حفظ سعر الوحدة.');
        await fetchOverride();
        setEditing(false);
      }
    } catch (e: any) {
      setOverrideValue(prev);
      toast.error(e.message || 'فشل الحفظ');
    } finally { setLoading(false); }
  }

  async function removeOverride() {
    if (overrideValue == null) return;
    const prev = overrideValue;
    setOverrideValue(null); // optimistic
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/price-groups/${groupId}/package-prices/${packageId}/unit`, { method: 'DELETE' });
      if (!res.ok) {
        let msg = 'فشل الحذف';
        try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
        setOverrideValue(prev);
        toast.error(msg);
      } else {
        toast.success('تم حذف التخصيص.');
        await fetchOverride();
      }
    } catch (e: any) {
      setOverrideValue(prev);
      toast.error(e.message || 'فشل الحذف');
    } finally { setLoading(false); setEditing(false); }
  }

  if (!editing) {
    const effective = overrideValue != null ? clampPriceDecimals(overrideValue, digits) : '—';
    return (
      <div className="flex items-center gap-1">
        <span className="text-sm font-medium">{effective}</span>
        {overrideValue != null && (
          <span className="text-[10px] px-1 py-0.5 rounded bg-primary/20 text-primary">معدل</span>
        )}
        <button
          aria-label="تعديل سعر الوحدة"
          onClick={startEdit}
          className="text-xs px-1.5 py-0.5 rounded bg-bg-surface-alt border border-border hover:bg-primary/10"
        >تعديل</button>
        {overrideValue != null && (
          <button
            aria-label="حذف التخصيص"
            onClick={removeOverride}
            className="text-xs px-1.5 py-0.5 rounded bg-danger text-text-inverse hover:brightness-110"
          >×</button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1" aria-busy={loading || undefined}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        step={step}
        className="input w-24"
        value={draft}
        disabled={loading}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setEditing(false); } }}
        onBlur={() => { /* keep edit mode until explicit save/cancel */ }}
    placeholder={'0'}
        aria-label="قيمة سعر الوحدة"
      />
      <button
        onClick={save}
        disabled={loading}
        className="text-xs px-2 py-1 rounded bg-success text-text-inverse hover:brightness-110 disabled:opacity-50"
      >✓</button>
      <button
        onClick={() => { setEditing(false); setDraft(''); }}
        disabled={loading}
        className="text-xs px-2 py-1 rounded bg-gray-600 text-text-inverse hover:brightness-110 disabled:opacity-50"
      >إلغاء</button>
      {overrideValue != null && !loading && (
        <span className="text-[11px] text-text-secondary">(override)</span>
      )}
      {loading && <span className="text-[11px] text-text-secondary">…</span>}
    </div>
  );
}
