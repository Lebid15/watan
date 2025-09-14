'use client';

import { useEffect, useState, useMemo } from "react";
import toast from 'react-hot-toast';
import { getDecimalDigits, formatPrice, priceInputStep, clampPriceDecimals } from '@/utils/pricingFormat';
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
  baseUnitPrice?: number | null;
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
  const [unitError, setUnitError] = useState<string>('');
  const [effectiveUnitPrice, setEffectiveUnitPrice] = useState<number | null>(null);

  const apiHost = useMemo(
    () => API_ROUTES.products.base.replace(/\/api(?:\/products)?\/?$/, ''),
    []
  );
  const getUserPriceGroupId = () =>
    (user as any)?.priceGroupId ||
    (user as any)?.priceGroup?.id ||
    null;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = `${API_ROUTES.products.base}/user/${id}`;
        const res = await api.get<Product>(url);
        setProduct(res.data);
        setCurrencyCode(res.data?.currencyCode || (user as any)?.currencyCode || 'USD');
      } catch {
        setError('فشل في جلب بيانات المنتج');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id, user]);

  const getPrice = (pkg: Package) => {
    const gid = getUserPriceGroupId();
    if (gid && Array.isArray(pkg.prices) && pkg.prices.length) {
      const match = pkg.prices.find(p => p.groupId === gid);
      if (match && typeof match.price === 'number') return Number(match.price);
    }
    return Number(pkg.basePrice ?? 0);
  };

  const openModal = (pkg: Package) => {
    if (!pkg.isActive) return;
    if (pkg.type === 'unit') {
      setUnitSelectedPkgId(pkg.id);
      setUnitQuantity('');
      setGameId('');
      setExtraField('');
      setUnitError('');
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

  if (loading) return <p className="text-center mt-6">جاري التحميل...</p>;
  if (error || !product) return <p className="text-center mt-6 text-danger">{error || 'المنتج غير موجود'}</p>;

  const activePkgs = (product.packages || []).filter(p => p.isActive);
  const sym = currencySymbol(currencyCode);
  const imageSrc = normalizeImageUrl(product.imageUrl, apiHost);
  const unitPkgs = activePkgs.filter(p => p.type === 'unit');
  const selectedUnitPackage = unitPkgs.find(p => p.id === unitSelectedPkgId) || unitPkgs[0];

  // ====== منطق التسعير للوحدات داخل المودال ======
  const digits = getDecimalDigits();
  const step = selectedUnitPackage?.step != null && selectedUnitPackage.step > 0 ? selectedUnitPackage.step : Number(priceInputStep(digits));
  const minUnits = selectedUnitPackage?.minUnits ?? null;
  const maxUnits = selectedUnitPackage?.maxUnits ?? null;
  const baseUnitPrice = selectedUnitPackage?.baseUnitPrice ?? null;

  useEffect(() => {
    let cancelled = false;
    async function loadEffectiveUnitPrice() {
      if (!selectedUnitPackage) { setEffectiveUnitPrice(null); return; }
      try {
        const res = await fetch('/api/pricing/unit-price', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupId: getUserPriceGroupId(),
            packageId: selectedUnitPackage.id,
            baseUnitPrice: baseUnitPrice
          })
        });
        if (!res.ok) throw new Error();
        const j = await res.json();
        if (!cancelled) setEffectiveUnitPrice(typeof j?.price === 'number' ? j.price : baseUnitPrice);
      } catch {
        if (!cancelled) setEffectiveUnitPrice(baseUnitPrice || null);
      }
    }
    if (unitModalOpen) loadEffectiveUnitPrice();
    return () => { cancelled = true; };
  }, [unitModalOpen, unitSelectedPkgId, baseUnitPrice, selectedUnitPackage, getUserPriceGroupId]);

  const unitQtyNum = unitQuantity === '' ? null : Number(unitQuantity);
  const unitValidNumber = unitQtyNum != null && !isNaN(unitQtyNum);

  function validateUnitPurchase(): boolean {
    if (!selectedUnitPackage) { setUnitError('الباقة غير صالحة'); return false; }
    if (unitQtyNum == null || !unitValidNumber) { setUnitError('أدخل كمية صحيحة'); return false; }
    if (unitQtyNum <= 0) { setUnitError('الكمية يجب أن تكون أكبر من صفر'); return false; }
    if (minUnits != null && unitQtyNum < minUnits) { setUnitError('الكمية أقل من الحد الأدنى'); return false; }
    if (maxUnits != null && unitQtyNum > maxUnits) { setUnitError('الكمية أعلى من الحد الأقصى'); return false; }
    const base = minUnits != null ? minUnits : 0;
    const diff = unitQtyNum - base;
    const tol = 1e-9;
    if (step > 0) {
      const multiples = Math.round(diff / step);
      const reconstructed = multiples * step;
      if (Math.abs(reconstructed - diff) > tol) { setUnitError('الكمية لا تطابق خطوة الزيادة'); return false; }
    }
    if (!gameId.trim()) { setUnitError('الرجاء إدخال معرف اللعبة'); return false; }
    setUnitError('');
    return true;
  }

  const unitPriceDisplay = effectiveUnitPrice != null ? formatPrice(effectiveUnitPrice, digits) : '—';
  const unitTotalDisplay = (() => {
    if (!effectiveUnitPrice || !unitValidNumber) return '—';
    return formatPrice(effectiveUnitPrice * (unitQtyNum || 0), digits);
  })();

  const hintParts: string[] = [];
  if (minUnits != null) hintParts.push(`الحد الأدنى: ${minUnits}`);
  if (maxUnits != null) hintParts.push(`الأقصى: ${maxUnits}`);
  hintParts.push(`الخطوة: ${step}`);

  async function submitUnitPurchase() {
    if (!product) return; // safeguard
    if (!validateUnitPurchase() || !selectedUnitPackage || unitQtyNum == null) return;
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
      alert('فشل في تنفيذ الطلب');
    } finally {
      setUnitSubmitting(false);
    }
  }

  return (
    <div className="p-3 text-center bg-bg-base text-text-primary">
      <h1 className="text-xl font-bold mb-3">{product.name}</h1>

      {activePkgs.length === 0 ? (
        <p className="text-text-secondary">لا توجد باقات متاحة.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {activePkgs.map((pkg) => {
            const price = getPrice(pkg);
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
                  {formatMoney(price, currencyCode, { fractionDigits: 2, withSymbol: false })} {sym}
                </div>
              </div>
            );
          })}
        </div>
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
              placeholder="هنا اكتب الايدي"
              className="input w-full mb-4 bg-bg-input border-border"
            />

            {/* 👇 الحقل الإضافي الاختياري */}
            <p className="mb-2 text-text-secondary">معلومة إضافية (اختياري)</p>
            <input
              type="text"
              value={extraField}
              onChange={e => setExtraField(e.target.value)}
              placeholder="مثلاً: السيرفر / المنطقة / ملاحظة…"
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
            <h2 className="text-sm font-bold mb-3 flex items-center justify-between">
              <span>الشراء بالعداد</span>
              <button onClick={() => setUnitModalOpen(false)} className="text-xs text-text-secondary hover:text-text-primary">إغلاق ✕</button>
            </h2>
            {unitPkgs.length > 1 && (
              <div className="mb-3">
                <label className="block text-[11px] mb-1 text-text-secondary">اختر باقة الوحدات</label>
                <select
                  className="input w-full"
                  value={unitSelectedPkgId || selectedUnitPackage.id}
                  onChange={e => { setUnitSelectedPkgId(e.target.value); setUnitQuantity(''); setUnitError(''); }}
                >
                  {unitPkgs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div className="mb-3">
              <label className="block text-[11px] mb-1 text-text-secondary">معرف اللعبة</label>
              <input
                type="text"
                className={`input w-full ${unitError === 'الرجاء إدخال معرف اللعبة' ? 'border-danger' : ''}`}
                value={gameId}
                onChange={e => setGameId(e.target.value)}
                placeholder="اكتب المعرف هنا"
              />
            </div>

            <div className="mb-3">
              <label className="block text-[11px] mb-1 text-text-secondary">معلومة إضافية (اختياري)</label>
              <input
                type="text"
                className="input w-full"
                value={extraField}
                onChange={e => setExtraField(e.target.value)}
                placeholder="مثلاً: السيرفر / المنطقة"
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
                className={`input w-full ${unitError ? 'border-danger' : ''}`}
                value={unitQuantity}
                onChange={e => setUnitQuantity(e.target.value)}
                onBlur={() => { if (unitQuantity) setUnitQuantity(String(clampPriceDecimals(Number(unitQuantity), digits))); validateUnitPurchase(); }}
              />
              <div className="text-[11px] text-text-secondary mt-1">{hintParts.join(' | ')}</div>
              {unitError && <div className="text-[11px] mt-1 text-danger">{unitError}</div>}
            </div>

            <div className="text-[12px] mb-3">
              <span className="text-text-secondary">السعر الفوري: </span>
              {unitPriceDisplay} × {unitQuantity || 0} = <span className="font-semibold">{unitTotalDisplay}</span>
            </div>

            <button
              className="btn btn-primary w-full disabled:opacity-60"
              disabled={unitSubmitting || !unitQuantity || !!unitError}
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
