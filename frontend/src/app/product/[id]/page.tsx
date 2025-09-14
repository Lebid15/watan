'use client';

import { useEffect, useState, useMemo } from "react";
import toast from 'react-hot-toast';
import { getDecimalDigits, formatPrice, priceInputStep, clampPriceDecimals } from '@/utils/pricingFormat';
// fetchUnitPrice أصبح غير مستخدم بعد اعتماد صف السعر الواحد لكل مجموعة
// CounterPurchaseCard (old always-visible component) removed in favor of on-demand modal
import { useParams, useRouter  } from "next/navigation";
import api, { API_ROUTES } from '@/utils/api';
import { useUser } from '../../../context/UserContext';
import { formatMoney, currencySymbol as getCurrencySymbol  } from '@/utils/format';
import { useAuthRequired } from '@/hooks/useAuthRequired';

// ====== الأنواع ======
interface PackagePriceItem {
  groupId: string;
  price: number;
}

interface Package {
  id: string;
  name: string;
  basePrice?: number;
  isActive: boolean;
  description?: string;
  prices?: PackagePriceItem[];
  // unit pricing fields (present only if type==='unit')
  type?: 'fixed' | 'unit';
  unitName?: string | null;
  unitCode?: string | null;
  minUnits?: number | null;
  maxUnits?: number | null;
  step?: number | null;
}

interface Product {
  id: string;
  name: string;
  imageUrl?: string | null;
  isActive: boolean;
  packages: Package[];
  currencyCode?: string;
  supportsCounter?: boolean;
}

function currencySymbol(code?: string) {
  switch (code) {
    case 'USD': return '$';
    case 'EUR': return '€';
    case 'TRY': return '₺';
    case 'SAR': return '﷼';
    case 'AED': return 'د.إ';
    case 'SYP': return 'ل.س';
    case 'EGP': return '£';
    default: return code || '';
  }
}

function normalizeImageUrl(raw: string | null | undefined, apiHost: string): string {
  if (!raw) return '/images/placeholder.png';
  const s = String(raw).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const host = apiHost.replace(/\/+$/, '');
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${host}${path}`;
}

export default function ProductDetailsPage() {
  useAuthRequired();

  const { id } = useParams();
  const router = useRouter();
  const { user, refreshProfile } = useUser();

  const [product, setProduct] = useState<Product | null>(null);
  const [currencyCode, setCurrencyCode] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [gameId, setGameId] = useState("");
  const [extraField, setExtraField] = useState("");
  const [buying, setBuying] = useState(false);
  // ====== حالة شراء الوحدات في نافذة منبثقة ======
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [unitSelectedPkgId, setUnitSelectedPkgId] = useState<string>('');
  const [unitQuantity, setUnitQuantity] = useState<string>('');
  const [unitSubmitting, setUnitSubmitting] = useState(false);
  // أخطاء مفصولة: خطأ الكمية وخطأ معرف اللعبة
  const [unitQtyError, setUnitQtyError] = useState<string>('');
  const [unitGameIdError, setUnitGameIdError] = useState<string>('');
  // سعر الوحدة الأساس (يفترض أنه بالدولار من الباك) + معدل التحويل + نسخة محوّلة
  const [effectiveUnitPriceUSD, setEffectiveUnitPriceUSD] = useState<number | null>(null);
  const [currencyRate, setCurrencyRate] = useState<number>(1); // معدل تحويل من USD -> عملة المستخدم

  const apiHost = useMemo(
    () => API_ROUTES.products.base.replace(/\/api(?:\/products)?\/?$/, ''),
    []
  );
  // Memoize priceGroupId to avoid recreating function dependency loops
  const userPriceGroupId = useMemo(() => {
    return (user as any)?.priceGroupId || (user as any)?.priceGroup?.id || null;
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const url = `${API_ROUTES.products.base}/user/${id}`;
        const res = await api.get<Product>(url);
        if (cancelled) return;
        setProduct(res.data);
        setCurrencyCode(res.data?.currencyCode || (user as any)?.currencyCode || 'USD');
        // تهيئة معرف أول باقة وحدات إن لم يكن محدداً
        const firstUnit = res.data?.packages?.find(p => p.isActive && p.type === 'unit');
        setUnitSelectedPkgId(prev => prev || (firstUnit?.id || ''));
      } catch (e) {
        if (!cancelled) setError('فشل في جلب بيانات المنتج');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (id) fetchData();
    return () => { cancelled = true; };
  }, [id, user]);

  const getPrice = (pkg: Package) => {
    const gid = userPriceGroupId;
    if (gid && Array.isArray(pkg.prices) && pkg.prices.length) {
      const match = pkg.prices.find(p => p.groupId === gid);
      if (match && typeof match.price === 'number') return Number(match.price);
    }
    return Number(pkg.basePrice ?? 0);
  };

  const openModal = (pkg: Package) => {
    if (!pkg.isActive) return;
    if (pkg.type === 'unit') {
      // لا تفتح المودال إذا لا توجد أي باقات وحدات نشطة (حماية)
      if (!unitPkgs.length) return;
      setUnitSelectedPkgId(pkg.id);
      setUnitQuantity('');
      setGameId('');
      setExtraField('');
      setUnitQtyError('');
      setUnitGameIdError('');
      setUnitModalOpen(true);
      return;
    }
    // باقات ثابتة
    setSelectedPackage(pkg);
    setGameId('');
    setExtraField('');
  };

  const confirmBuy = async () => {
    if (!selectedPackage || !product) return;
    const price = getPrice(selectedPackage);
    if (!gameId.trim()) return alert('الرجاء إدخال معرف اللعبة');

    try {
  setBuying(true);
      await api.post(API_ROUTES.orders.base, {
        productId: product.id,
        packageId: selectedPackage.id,
        quantity: 1,
        userIdentifier: gameId,
        // 👇 الجديد (اختياري)
        extraField: extraField?.trim() ? extraField.trim() : undefined,
      });
      
  await refreshProfile();
      router.push('/orders');
      alert(`تم إنشاء الطلب: ${selectedPackage.name} بسعر ${formatMoney(price, currencyCode, { fractionDigits: 2, withSymbol: true, symbolBefore: true })}`);
    } catch {
      alert('فشل في تنفيذ الطلب');
    } finally {
      setBuying(false);
      setSelectedPackage(null);
    }
  };

  // احسب القيم حتى لو لم يكتمل التحميل (باستخدام حمايات)
  const activePkgs = product ? (product.packages || []).filter(p => p.isActive) : [];
  const sym = currencySymbol(currencyCode);
  const imageSrc = normalizeImageUrl(product?.imageUrl || null, apiHost);
  const unitPkgs = activePkgs.filter(p => p.type === 'unit');
  const selectedUnitPackage = unitPkgs.find(p => p.id === unitSelectedPkgId) || unitPkgs[0];
  // خريطة أسعار الوحدات (محولة لعملة المستخدم) لعرضها على الكروت
  const [unitCardPrices, setUnitCardPrices] = useState<Record<string, number>>({});
  // توقيع للتغيرات في أسعار الوحدات (بعد إزالة baseUnitPrice نعتمد فقط على صف السعر حسب المجموعة)
  const unitPricesSignature = useMemo(() => {
    // تتبع التغير في سعر مجموعة المستخدم. دعم كلّا من groupId و priceGroupId لاحتمال اختلاف التسمية.
    return unitPkgs.map(p => {
      let grp: any = 'null';
      if (Array.isArray(p.prices) && p.prices.length) {
        let row: any = null;
        if (userPriceGroupId) {
          row = p.prices.find(r => (r as any).groupId === userPriceGroupId || (r as any).priceGroupId === userPriceGroupId) || null;
        }
        // إن لم نجد الصف (أو لا توجد مجموعة للمستخدم) خذ أول صف كعرض افتراضي حتى لا يبقى السعر فارغاً
        if (!row) row = p.prices[0];
        const val = row?.unitPrice != null ? row.unitPrice : row?.price;
        if (val != null) grp = Number(val);
      }
      return `${p.id}:${grp}`;
    }).join('|');
  }, [unitPkgs, userPriceGroupId]);

  useEffect(() => {
    let cancelled = false;
    async function loadUnitCardPrices() {
      if (!activePkgs.length) return;
      const code = currencyCode || 'USD';
      let rate = 1;
      if (code !== 'USD') {
        try {
          const res = await api.get<any[]>(API_ROUTES.currencies.base);
            const list = Array.isArray(res.data) ? res.data : [];
            const row = list.find((c:any) => (c.code || c.currency || c.symbol) === code);
            if (row) {
              const r = Number(row.rate ?? row.factor ?? row.value ?? row.usdRate ?? 0);
              if (r > 0) rate = r;
            }
        } catch { /* ignore */ }
      }
      const map: Record<string, number> = {};
      for (const p of unitPkgs) {
        let eff: number | null = null;
        if (Array.isArray(p.prices) && p.prices.length) {
          let row: any = null;
            if (userPriceGroupId) {
              row = p.prices.find(pr => (pr as any).groupId === userPriceGroupId || (pr as any).priceGroupId === userPriceGroupId) || null;
            }
            if (!row) row = p.prices[0]; // fallback للعرض فقط
            if (row) {
              const raw = row.unitPrice != null ? row.unitPrice : row.price;
              if (raw != null && Number(raw) > 0) eff = Number(raw);
            }
        }
        if (eff != null) map[p.id] = code === 'USD' ? eff : eff * rate;
      }
      if (!cancelled) setUnitCardPrices(map);
    }
    loadUnitCardPrices();
    return () => { cancelled = true; };
  }, [activePkgs.length, currencyCode, userPriceGroupId, unitPricesSignature]);

  // ====== منطق التسعير للوحدات داخل المودال ======
  const digits = getDecimalDigits();
  const step = selectedUnitPackage?.step != null && selectedUnitPackage.step > 0 ? selectedUnitPackage.step : Number(priceInputStep(digits));
  const minUnits = selectedUnitPackage?.minUnits ?? null;
  const maxUnits = selectedUnitPackage?.maxUnits ?? null;
  // أزيل baseUnitPrice: يجب توفر صف سعر للمجموعة وإلا يبقى null

  useEffect(() => {
    let cancelled = false;
    async function loadEffectiveUnitPrice() {
      if (!unitModalOpen) return;
      if (!selectedUnitPackage) { setEffectiveUnitPriceUSD(null); return; }
      let price: number | null = null;
      if (Array.isArray(selectedUnitPackage?.prices) && selectedUnitPackage.prices.length) {
        let row: any = null;
        if (userPriceGroupId) {
          row = selectedUnitPackage.prices.find(pr => (pr as any).groupId === userPriceGroupId || (pr as any).priceGroupId === userPriceGroupId) || null;
        }
        if (!row) row = selectedUnitPackage.prices[0];
        if (row) {
          const raw = row.unitPrice != null ? row.unitPrice : row.price;
          if (raw != null && Number(raw) > 0) price = Number(raw);
        }
      }
      // لا fallback بعد الآن
      if (!cancelled) setEffectiveUnitPriceUSD(price);
    }
    loadEffectiveUnitPrice();
    return () => { cancelled = true; };
  // أعد التحميل عند تغير الصف أو المجموعة
  }, [unitModalOpen, userPriceGroupId, selectedUnitPackage?.id, unitPricesSignature]);

  // جلب معدل التحويل للعملة الحالية إذا لم تكن USD
  useEffect(() => {
    let cancelled = false;
    async function loadRate() {
      if (!unitModalOpen) return;
      const code = currencyCode || 'USD';
      if (code === 'USD') { setCurrencyRate(1); return; }
      try {
        const res = await api.get<any[]>(API_ROUTES.currencies.base);
        const list = Array.isArray(res.data) ? res.data : [];
        const row = list.find((c:any) => (c.code || c.currency || c.symbol) === code);
        if (!cancelled && row) {
          const r = Number(row.rate ?? row.factor ?? row.value ?? row.usdRate ?? 0);
          if (r > 0) setCurrencyRate(r); else setCurrencyRate(1);
        }
      } catch { /* تجاهل */ }
    }
    loadRate();
    return () => { cancelled = true; };
  }, [unitModalOpen, currencyCode]);

  const unitQtyNum = unitQuantity === '' ? null : Number(unitQuantity);
  const unitValidNumber = unitQtyNum != null && !isNaN(unitQtyNum);
  function validateQuantity(): boolean {
    setUnitQtyError('');
    if (!selectedUnitPackage) { setUnitQtyError('الباقة غير صالحة'); return false; }
    if (unitQtyNum == null || !unitValidNumber) { setUnitQtyError('أدخل كمية صحيحة'); return false; }
    if (unitQtyNum <= 0) { setUnitQtyError('الكمية يجب أن تكون أكبر من صفر'); return false; }
    if (minUnits != null && unitQtyNum < minUnits) { setUnitQtyError('الكمية أقل من الحد الأدنى'); return false; }
    if (maxUnits != null && unitQtyNum > maxUnits) { setUnitQtyError('الكمية أعلى من الحد الأقصى'); return false; }
    const base = minUnits != null ? minUnits : 0;
    const diff = unitQtyNum - base;
    const tol = 1e-9;
    if (step > 0) {
      const multiples = Math.round(diff / step);
      const reconstructed = multiples * step;
      if (Math.abs(reconstructed - diff) > tol) { setUnitQtyError('الكمية لا تطابق خطوة الزيادة'); return false; }
    }
    return true;
  }

  function validateUnitPurchase(): boolean {
    const okQty = validateQuantity();
    setUnitGameIdError('');
    if (!okQty) return false;
    if (!gameId.trim()) { setUnitGameIdError('الرجاء إدخال معرف اللعبة'); return false; }
    return true;
  }

  // عرض الأسعار بعملة المستخدم (كما في عرض الباقات خارج المودال)
  const unitPriceDisplay = effectiveUnitPriceUSD != null
    ? (currencyCode === 'USD'
        ? formatMoney(effectiveUnitPriceUSD, currencyCode, { fractionDigits: 2, withSymbol: false })
        : formatMoney(effectiveUnitPriceUSD * currencyRate, currencyCode, { fractionDigits: 2, withSymbol: false }))
    : '—';
  const unitTotalDisplay = (() => {
    if (!effectiveUnitPriceUSD || !unitValidNumber) return '—';
    const totalBase = effectiveUnitPriceUSD * (unitQtyNum || 0);
    const total = currencyCode === 'USD' ? totalBase : totalBase * currencyRate;
    return formatMoney(total, currencyCode, { fractionDigits: 2, withSymbol: false });
  })();

  const hintParts: string[] = [];
  if (minUnits != null) hintParts.push(`الحد الأدنى: ${minUnits}`);
  if (maxUnits != null) hintParts.push(`الأقصى: ${maxUnits}`);
  hintParts.push(`الخطوة: ${step}`);

  async function submitUnitPurchase() {
    if (!product) return; // safeguard
    if (!validateUnitPurchase() || !selectedUnitPackage || unitQtyNum == null) return;
    if (effectiveUnitPriceUSD == null) {
      setUnitQtyError('تعذر الحصول على سعر الوحدة حالياً');
      return;
    }
    try {
      setUnitSubmitting(true);
      await api.post(API_ROUTES.orders.base, {
        productId: product.id,
        packageId: selectedUnitPackage.id,
        quantity: unitQtyNum,
        userIdentifier: gameId.trim(),
        extraField: extraField?.trim() ? extraField.trim() : undefined,
      });
      await refreshProfile();
      setUnitModalOpen(false);
      setUnitQuantity('');
      setGameId('');
      setExtraField('');
      alert('تم إنشاء الطلب');
      router.push('/orders');
    } catch (e) {
  console.error(e);
  alert('فشل في تنفيذ الطلب');
    } finally {
      setUnitSubmitting(false);
    }
  }

  return (
    <div className="p-3 text-center bg-bg-base text-text-primary">
      {loading && (
        <p className="text-center mt-6">جاري التحميل...</p>
      )}
      {!loading && (error || !product) && (
        <p className="text-center mt-6 text-danger">{error || 'المنتج غير موجود'}</p>
      )}
      {!loading && product && (
        <>
          <h1 className="text-xl font-bold mb-3">{product.name}</h1>
          {activePkgs.length === 0 ? (
            <p className="text-text-secondary">لا توجد باقات متاحة.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activePkgs.map((pkg) => {
                const price = pkg.type === 'unit'
                  ? (unitCardPrices[pkg.id] ?? null)
                  : getPrice(pkg);
                return (
                  <div
                    key={pkg.id}
                    onClick={() => openModal(pkg)}
                    className={`flex items-center justify-between gap-3 pl-3 py-1 pr-1 rounded-xl border transition
                                bg-bg-surface border-border shadow
                                ${pkg.isActive ? 'cursor-pointer hover:bg-bg-surface-alt' : 'opacity-50 pointer-events-none'}`}
                    title={pkg.name}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-border bg-bg-surface shrink-0">
                        <img
                          src={imageSrc}
                          alt={pkg.name}
                          className="w-full h-full object-cover rounded-xl"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = '/images/placeholder.png';
                          }}
                        />
                      </div>
                      <div className="min-w-0 text-right">
                        <div className="text-sm truncate text-text-primary flex items-center gap-1 justify-end">
                          <span className="truncate">{pkg.name}</span>
                          {pkg.type === 'unit' && (
                            <span className="text-[10px] px-1 py-0.5 rounded bg-primary/20 text-primary" title="الشراء بالعداد من الأسفل">وحدات</span>
                          )}
                        </div>
                        {pkg.description ? (
                          <div className="text-xs truncate text-text-secondary">{pkg.description}</div>
                        ) : null}
                        {pkg.type === 'unit' && (
                          <div className="text-[10px] text-text-secondary mt-0.5">السعر حسب الكمية</div>
                        )}
                      </div>
                    </div>

                    <div className="text-sm shrink-0 text-primary font-medium">
                      {price != null ? (
                        <>{formatMoney(price, currencyCode, { fractionDigits: 2, withSymbol: false })} {sym}</>
                      ) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* لم يعد يظهر الشراء بالعداد تلقائياً */}

      {selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card w-80 p-6 text-center">
            <h2 className="text-base font-bold mb-2">
              {selectedPackage.name} - {formatMoney(getPrice(selectedPackage), currencyCode, { fractionDigits: 2, withSymbol: true, symbolBefore: true })}
            </h2>

            <p className="mb-2 text-text-secondary">أدخل معرف اللعبة / التطبيق</p>
            <input
              type="text"
              value={gameId}
              onChange={e => setGameId(e.target.value)}
              className="input w-full mb-4 bg-bg-input border-border"
            />

            {/* 👇 الحقل الإضافي الاختياري */}
            <p className="mb-2 text-text-secondary">معلومة إضافية (اختياري)</p>
            <input
              type="text"
              value={extraField}
              onChange={e => setExtraField(e.target.value)}
              className="input w-full mb-4 bg-bg-input border-border"
            />

            <div className="flex justify-center gap-3">
              <button
                onClick={confirmBuy}
                disabled={buying}
                className={`btn btn-primary ${buying ? 'opacity-80 cursor-wait' : ''}`}
              >
                {buying ? 'جاري الشراء...' : 'تأكيد'}
              </button>
              <button
                onClick={() => setSelectedPackage(null)}
                className="btn btn-secondary"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {unitModalOpen && selectedUnitPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card w-[340px] p-5 text-right">
            <h2 className="text-sm font-bold mb-1 flex items-center justify-between">
              <span>{selectedUnitPackage.name}{unitQuantity ? ` — ${unitQuantity} ${(selectedUnitPackage.unitName || 'وحدة')}` : ''}</span>
              <button onClick={() => setUnitModalOpen(false)} className="text-xs text-text-secondary hover:text-text-primary">إغلاق ✕</button>
            </h2>
            <div className="text-[11px] text-text-secondary mb-3">الشراء بالعداد</div>
            {unitPkgs.length > 1 && (
              <div className="mb-3">
                <label className="block text-[11px] mb-1 text-text-secondary">اختر باقة الوحدات</label>
                <select
                  className="input w-full"
                  value={unitSelectedPkgId || selectedUnitPackage.id}
                  onChange={e => { setUnitSelectedPkgId(e.target.value); setUnitQuantity(''); setUnitQtyError(''); setUnitGameIdError(''); }}
                >
                  {unitPkgs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className="block text-[11px] mb-1 text-text-secondary">معرف اللعبة</label>
              <input
                type="text"
                className={`input w-full ${unitGameIdError ? 'border-danger' : ''}`}
                value={gameId}
                onChange={e => { setGameId(e.target.value); if (e.target.value.trim()) setUnitGameIdError(''); }}
              />
              {unitGameIdError && <div className="text-[11px] mt-1 text-danger">{unitGameIdError}</div>}
            </div>

            <div className="mb-3">
              <label className="block text-[11px] mb-1 text-text-secondary">معلومة إضافية (اختياري)</label>
              <input
                type="text"
                className="input w-full"
                value={extraField}
                onChange={e => setExtraField(e.target.value)}
              />
            </div>

            <div className="mb-3">
              <label className="block text-[11px] mb-1 text-text-secondary">الكمية ( {selectedUnitPackage?.unitName || 'وحدة'} )</label>
              <input
                type="number"
                inputMode="decimal"
                step={step}
                min={minUnits != null ? minUnits : undefined}
                max={maxUnits != null ? maxUnits : undefined}
                className={`input w-full ${unitQtyError ? 'border-danger' : ''}`}
                value={unitQuantity}
                onChange={e => { setUnitQuantity(e.target.value); if (unitQtyError) setUnitQtyError(''); }}
                onBlur={() => { if (unitQuantity) setUnitQuantity(String(clampPriceDecimals(Number(unitQuantity), digits))); validateQuantity(); }}
              />
              <div className="text-[11px] text-text-secondary mt-1">{hintParts.join(' | ')}</div>
              {unitQtyError && <div className="text-[11px] mt-1 text-danger">{unitQtyError}</div>}
            </div>

            <div className="text-[12px] mb-3">
              <span className="text-text-secondary">السعر الفوري:</span>{' '}
              {unitPriceDisplay !== '—' ? (
                <span className="font-medium">{unitPriceDisplay} {sym}</span>
              ) : '—'}
              {' '}× {unitQuantity || 0} ={' '}
              <span className="font-semibold">{unitTotalDisplay !== '—' ? `${unitTotalDisplay} ${sym}` : '—'}</span>
            </div>

            <button
              className="btn btn-primary w-full disabled:opacity-60"
              disabled={unitSubmitting || !unitQuantity || !!unitQtyError || !!unitGameIdError}
              onClick={submitUnitPurchase}
            >
              {unitSubmitting ? 'جارٍ الإرسال...' : 'شراء'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// CounterPurchaseCard moved to separate component for testing
