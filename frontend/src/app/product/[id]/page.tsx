'use client';

import { useEffect, useState, useMemo, useRef } from "react";
import toast from 'react-hot-toast';
import { getDecimalDigits, formatPrice, priceInputStep, clampPriceDecimals } from '@/utils/pricingFormat';
import CounterPurchaseCard from '@/components/CounterPurchaseCard';
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
  const counterRef = useRef<HTMLDivElement | null>(null);

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
      if (counterRef.current) {
        counterRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        counterRef.current.classList.add('ring-2','ring-primary');
        setTimeout(() => counterRef.current && counterRef.current.classList.remove('ring-2','ring-primary'), 1200);
      }
      return;
    }
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
  const showCounterCard = Boolean(product.supportsCounter && unitPkgs.length > 0);

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

      {showCounterCard && (
        <div ref={counterRef} className="mt-8 max-w-md mx-auto w-full scroll-mt-20">
          <CounterPurchaseCard
            product={product}
            packages={unitPkgs}
            currencyCode={currencyCode}
            getUserPriceGroupId={getUserPriceGroupId}
          />
        </div>
      )}

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
    </div>
  );
}

// CounterPurchaseCard moved to separate component for testing
