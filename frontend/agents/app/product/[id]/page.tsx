'use client';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from '../../../context/UserContext';
import { getMockProductById, type MockProduct } from '@/data/mockProducts';
import { useTranslation } from 'react-i18next';
import { loadNamespace } from '@/i18n/client';

interface MockPackage {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  description?: string;
}
import toast from 'react-hot-toast';

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
  const { user } = useUser();
  const { t, i18n } = useTranslation('common');
  const [namespaceReady, setNamespaceReady] = useState(false);

  const [product, setProduct] = useState<MockProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPackage, setSelectedPackage] = useState<MockPackage | null>(null);
  const [gameId, setGameId] = useState("");
  const [purchasing, setPurchasing] = useState(false);

  const activeLocale = i18n.language || i18n.resolvedLanguage || 'ar';

  useEffect(() => {
    let mounted = true;
    setNamespaceReady(false);
    (async () => {
      try {
        await loadNamespace(activeLocale, 'common');
      } catch {}
      if (mounted) setNamespaceReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [activeLocale]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const mockProduct = getMockProductById(id as string);
      if (mockProduct) {
        setProduct(mockProduct);
      } else {
        setError(t('product.notFound'));
      }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [id, t]);

  const openModal = (pkg: MockPackage) => {
    setSelectedPackage(pkg);
    setGameId('');
  };

  const confirmPurchase = async () => {
    if (!selectedPackage || !product) return;
    if (!gameId.trim()) {
      toast.error(t('product.purchaseModal.gameIdRequired'));
      return;
    }

    setPurchasing(true);
    // محاكاة عملية الشراء
    await new Promise(resolve => setTimeout(resolve, 1500));
    setPurchasing(false);
    setSelectedPackage(null);
    setGameId('');
    toast.success(t('product.purchaseModal.success'));
  };

  const activePkgs = product?.packages?.filter(p => p.isActive) || [];
  const currencyCode = user?.currencyCode || 'USD';
  const sym = currencySymbol(currencyCode);

  if (!namespaceReady) {
    return <div className="min-h-screen p-4 bg-bg-base text-text-primary">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mt-12">
          <p className="text-lg">{t('common.loading')}</p>
        </div>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen p-4 bg-bg-base text-text-primary">
      <div className="max-w-4xl mx-auto">
        {loading && (
          <div className="text-center mt-12">
            <p className="text-lg">{t('product.loading')}</p>
          </div>
        )}
        
        {!loading && (error || !product) && (
          <div className="text-center mt-12">
            <p className="text-lg text-red-500">{error || t('product.notFound')}</p>
          </div>
        )}
        
        {!loading && product && (
          <div>
            {/* Product Header - شعار + اسم فقط */}
            <div className="bg-bg-surface rounded-xl p-4 mb-6 border border-border">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-border bg-bg-base shrink-0">
                    <img
                      src={product.imageUrl || '/images/placeholder.png'}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = '/images/placeholder.png';
                      }}
                    />
                  </div>
                  <h1 className="text-xl font-bold">{product.name}</h1>
                </div>
                <button
                  onClick={() => window.history.back()}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 backdrop-blur-sm border border-primary/30 flex items-center justify-center text-xl hover:from-primary/30 hover:to-primary/20 transition-all shadow-lg"
                  title={t('product.backToProducts')}
                >
                  ←
                </button>
              </div>
            </div>

            {/* Packages List - اسم + سعر فقط */}
            <div>
              {activePkgs.length === 0 ? (
                <div className="text-center py-8 bg-bg-surface rounded-xl border border-border">
                  <p className="text-text-secondary">{t('product.noPackagesAvailable')}</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activePkgs.map((pkg) => (
                    <div
                      key={pkg.id}
                      onClick={() => openModal(pkg)}
                      className="bg-bg-surface rounded-xl p-4 border border-border cursor-pointer hover:bg-bg-surface-alt transition-all hover:shadow-md flex items-center justify-between"
                    >
                      <span className="font-semibold">{pkg.name}</span>
                      <span className="text-lg font-bold text-primary">{pkg.price} {sym}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Purchase Modal */}
        {selectedPackage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="bg-bg-surface rounded-xl p-6 w-full max-w-md border border-border">
              <h2 className="text-xl font-bold mb-4">{t('product.purchaseModal.title')}</h2>
              
              <div className="mb-4 p-4 bg-bg-base rounded-lg border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-text-secondary">{t('product.purchaseModal.package')}</span>
                  <span className="font-semibold">{selectedPackage.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">{t('product.purchaseModal.price')}</span>
                  <span className="text-xl font-bold text-primary">
                    {selectedPackage.price} {sym}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">
                  {t('product.purchaseModal.gameIdLabel')}
                </label>
                <input
                  type="text"
                  value={gameId}
                  onChange={e => setGameId(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-bg-base border border-border focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('product.purchaseModal.gameIdPlaceholder')}
                  maxLength={120}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={confirmPurchase}
                  disabled={purchasing || !gameId.trim()}
                  className="flex-1 py-3 px-4 rounded-lg bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {purchasing ? t('product.purchaseModal.purchasing') : t('product.purchaseModal.confirmPurchase')}
                </button>
                <button
                  onClick={() => setSelectedPackage(null)}
                  disabled={purchasing}
                  className="px-6 py-3 rounded-lg bg-bg-base border border-border hover:bg-bg-surface-alt transition-all disabled:opacity-50"
                >
                  {t('product.purchaseModal.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
