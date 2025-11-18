'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from '../../../context/UserContext';
import { getMockProductById, type MockProduct } from '@/data/mockProducts';

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

export default function ProductDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useUser();

  const [product, setProduct] = useState<MockProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<any | null>(null);
  const [gameId, setGameId] = useState("");
  const [extraField, setExtraField] = useState("");
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    // محاكاة تحميل بيانات المنتج
    const timer = setTimeout(() => {
      const mockProduct = getMockProductById(id as string);
      if (mockProduct) {
        setProduct(mockProduct);
      } else {
        setError('المنتج غير موجود');
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [id]);

  const confirmBuy = async () => {
    if (!selectedPackage || !product) return;
    if (!gameId.trim()) {
      alert('الرجاء إدخال معرف اللعبة');
      return;
    }

    try {
      setBuying(true);
      // محاكاة الطلب
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert(`✅ تم شراء ${selectedPackage.name} بنجاح!\nمعرف اللعبة: ${gameId}`);
      router.push('/');
    } catch {
      alert('فشل في تنفيذ الطلب');
    } finally {
      setBuying(false);
      setSelectedPackage(null);
    }
  };

  const activePkgs = product?.packages?.filter(p => p.isActive) || [];
  const currencyCode = user?.currencyCode || user?.currency || 'USD';
  const sym = currencySymbol(currencyCode);

  return (
    <div className="p-3 text-center bg-bg-base text-text-primary min-h-screen">
      {loading && (
        <p className="text-center mt-6">جاري التحميل...</p>
      )}
      {!loading && (error || !product) && (
        <p className="text-center mt-6 text-danger">{error || 'المنتج غير موجود'}</p>
      )}
      {!loading && product && (
        <>
          <div className="mb-6">
            <div className="w-32 h-32 mx-auto mb-4 rounded-xl overflow-hidden border border-border bg-bg-surface">
              <img
                src={product.image || '/images/placeholder.png'}
                alt={product.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/images/placeholder.png';
                }}
              />
            </div>
            <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
            {product.description && (
              <p className="text-text-secondary text-sm">{product.description}</p>
            )}
          </div>

          {activePkgs.length === 0 ? (
            <p className="text-text-secondary">لا توجد باقات متاحة.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {activePkgs.map((pkg) => (
                <div
                  key={pkg.id}
                  onClick={() => {
                    if (pkg.isActive) {
                      setSelectedPackage(pkg);
                      setGameId('');
                      setExtraField('');
                    }
                  }}
                  className={`p-4 rounded-xl border transition bg-bg-surface border-border shadow
                              ${pkg.isActive ? 'cursor-pointer hover:bg-bg-surface-alt hover:border-primary' : 'opacity-50 pointer-events-none'}`}
                >
                  <div className="text-center">
                    <h3 className="text-lg font-semibold mb-2 text-text-primary">{pkg.name}</h3>
                    <div className="text-2xl font-bold text-primary">
                      {pkg.price.toFixed(2)} {sym}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal للشراء */}
      {selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="card w-full max-w-md p-6 text-center">
            <h2 className="text-xl font-bold mb-4">
              {selectedPackage.name}
            </h2>
            <div className="text-3xl font-bold text-primary mb-6">
              {selectedPackage.price.toFixed(2)} {sym}
            </div>

            <div className="mb-4 text-right">
              <label className="block text-sm mb-2 text-text-secondary">معرف اللعبة / التطبيق</label>
              <input
                type="text"
                value={gameId}
                onChange={e => setGameId(e.target.value)}
                className="input w-full bg-bg-input border-border"
                placeholder="أدخل معرف اللعبة"
                maxLength={120}
                autoFocus
              />
            </div>

            <div className="mb-6 text-right">
              <label className="block text-sm mb-2 text-text-secondary">معلومة إضافية (اختياري)</label>
              <input
                type="text"
                value={extraField}
                onChange={e => setExtraField(e.target.value)}
                className="input w-full bg-bg-input border-border"
                placeholder="معلومة إضافية"
                maxLength={120}
              />
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={confirmBuy}
                disabled={buying || !gameId.trim()}
                className={`btn btn-primary ${buying ? 'opacity-80 cursor-wait' : ''} ${!gameId.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {buying ? 'جاري الشراء...' : 'تأكيد الشراء'}
              </button>
              <button
                onClick={() => setSelectedPackage(null)}
                disabled={buying}
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
