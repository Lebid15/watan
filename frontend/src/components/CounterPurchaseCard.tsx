"use client";
import { useEffect, useState } from 'react';
import { getDecimalDigits, formatPrice, priceInputStep, clampPriceDecimals } from '@/utils/pricingFormat';
import fetchUnitPrice from '@/lib/pricing/fetchUnitPrice';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

interface PackagePriceItem { groupId: string; price: number; }
export interface CounterPackage {
  id: string;
  name: string;
  isActive: boolean;
  type?: 'fixed' | 'unit';
  unitName?: string | null;
  unitCode?: string | null;
  minUnits?: number | null;
  maxUnits?: number | null;
  step?: number | null;
  prices?: PackagePriceItem[];
}
export interface CounterProduct {
  id: string;
  name: string;
  supportsCounter?: boolean;
}
interface Props {
  product: CounterProduct;
  packages: CounterPackage[]; // only unit packages passed
  currencyCode?: string; // reserved for future formatting if needed
  getUserPriceGroupId: () => string | null;
}

const CounterPurchaseCard: React.FC<Props> = ({ product, packages, getUserPriceGroupId }) => {
  const router = useRouter();
  const digits = getDecimalDigits();
  const [selectedPkgId, setSelectedPkgId] = useState<string>(packages[0]?.id || '');
  const selectedPkg = packages.find(p => p.id === selectedPkgId) || packages[0];
  const [quantity, setQuantity] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');
  const [effectiveUnitPrice, setEffectiveUnitPrice] = useState<number | null>(null);
  const step = selectedPkg?.step != null && selectedPkg.step > 0 ? selectedPkg.step : Number(priceInputStep(digits));

  const min = selectedPkg?.minUnits ?? null;
  const max = selectedPkg?.maxUnits ?? null;
  // baseUnitPrice removed: prices must be resolved via group rows only

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedPkg) return;
      const price = await fetchUnitPrice({
        groupId: getUserPriceGroupId(),
        packageId: selectedPkg.id
      });
      if (!cancelled) setEffectiveUnitPrice(price);
    })();
    return () => { cancelled = true; };
  }, [selectedPkgId, getUserPriceGroupId, selectedPkg]);

  const unitPriceDisplay = effectiveUnitPrice != null ? formatPrice(effectiveUnitPrice, digits) : '—';
  const qtyNum = quantity === '' ? null : Number(quantity);
  const validNumber = qtyNum != null && !isNaN(qtyNum);

  function validate(): boolean {
    if (!selectedPkg) { setError('الباقة غير صالحة'); return false; }
    if (qtyNum == null || !validNumber) { setError('أدخل كمية صحيحة'); return false; }
    if (qtyNum <= 0) { setError('الكمية يجب أن تكون أكبر من صفر'); return false; }
    if (min != null && qtyNum < min) { setError('الكمية أقل من الحد الأدنى'); return false; }
    if (max != null && qtyNum > max) { setError('الكمية أعلى من الحد الأقصى'); return false; }
    const base = min != null ? min : 0;
    const diff = (qtyNum - base);
    const tol = 1e-9;
    if (step > 0) {
      const multiples = Math.round(diff / step);
      const reconstructed = multiples * step;
      if (Math.abs(reconstructed - diff) > tol) {
        setError('الكمية لا تطابق خطوة الزيادة');
        return false;
      }
    }
    setError('');
    return true;
  }

  const totalDisplay = (() => {
    if (!effectiveUnitPrice || !validNumber) return '—';
    const total = effectiveUnitPrice * (qtyNum || 0);
    return formatPrice(total, digits);
  })();

  function onQuantityChange(v: string) { setQuantity(v); }

  async function submit() {
    if (!validate()) return;
    if (!selectedPkg || qtyNum == null) return;
    try {
      setSubmitting(true);
      const body: any = { productId: product.id, packageId: selectedPkg.id, quantity: qtyNum };
      const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        let msg = 'فشل إنشاء الطلب';
        try { const j = await res.json(); if (j?.message) msg = j.message; } catch {}
        toast.error(msg);
        return;
      }
      let orderId: string | undefined;
      try { const j = await res.json(); if (j?.id) orderId = j.id; } catch {}
      toast.success('تم إنشاء الطلب');
      setQuantity('');
      if (orderId) router.push(`/orders/${orderId}`); else router.push('/orders');
    } catch (e: any) {
      toast.error(e.message || 'فشل إنشاء الطلب');
    } finally { setSubmitting(false); }
  }

  const hintParts: string[] = [];
  if (min != null) hintParts.push(`الحد الأدنى: ${min}`);
  if (max != null) hintParts.push(`الأقصى: ${max}`);
  hintParts.push(`الخطوة: ${step}`);

  return (
    <div className="p-4 rounded-xl border border-border bg-bg-surface shadow" aria-busy={submitting || undefined}>
      <h3 className="font-semibold mb-3 text-right text-sm">الشراء بالعداد</h3>
      {packages.length > 1 && (
        <div className="mb-3 text-right">
          <label className="block text-[12px] text-text-secondary mb-1">اختر الباقة</label>
          <select className="input w-full" value={selectedPkgId} onChange={e => { setSelectedPkgId(e.target.value); setQuantity(''); }}>
            {packages.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </select>
        </div>
      )}
      <div className="mb-3 text-right">
        <label className="block text-[12px] text-text-secondary mb-1" htmlFor="counter-qty">الكمية ( {selectedPkg?.unitName || 'وحدة'} )</label>
        <input
          id="counter-qty"
          aria-label="كمية الوحدات"
          type="number"
          inputMode="decimal"
          step={step}
          min={min != null ? min : undefined}
          max={max != null ? max : undefined}
          className={`input w-full ${error ? 'border-danger' : ''}`}
          value={quantity}
          onChange={e => onQuantityChange(e.target.value)}
          onBlur={() => { if (quantity) setQuantity(String(clampPriceDecimals(Number(quantity), digits))); validate(); }}
        />
        <div className="text-[11px] text-text-secondary mt-1">{hintParts.join(' | ')}</div>
        {error && <div className="text-[11px] mt-1 text-danger">{error}</div>}
      </div>
      <div aria-live="polite" className="text-sm mb-4 text-right">
        <span className="text-text-secondary">السعر الفوري: </span>
        {unitPriceDisplay} × {quantity || 0} = <span className="font-medium">{totalDisplay}</span>
      </div>
      <button disabled={submitting || !quantity || !!error} onClick={submit} className="btn btn-primary w-full disabled:opacity-60">
        {submitting ? 'جارٍ الإرسال...' : 'شراء'}
      </button>
    </div>
  );
};

export default CounterPurchaseCard;
