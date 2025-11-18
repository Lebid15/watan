'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useZNetData } from '@/hooks/useZNetData';
import { useBackendSession } from '@/context/auth-session';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchWithAuth, ZNetOrderResponse } from '@/lib/backend';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useProviderCredentialContext } from '@/hooks/useProviderCredentials';

export default function ProductDetailPage() {
  const t = useTranslations('ProductDetail');
  const locale = useLocale();
  const params = useParams();
  const productId = params.id as string;
  const { token, status, connect } = useBackendSession();
  const ready = status === 'ready';
  const {
    selectedCredentialId,
    hasCredentials,
    loading: credentialLoading,
  } = useProviderCredentialContext();
  const credentialReady = ready && Boolean(selectedCredentialId);
  const { products, loading } = useZNetData(credentialReady, selectedCredentialId);
  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const [playerId, setPlayerId] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ZNetOrderResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formatPrice = (value: number) =>
    new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : locale === 'tr' ? 'tr-TR' : 'en-US', {
      style: 'currency',
      currency: 'TRY',
    }).format(value);

  const placeOrder = async () => {
    if (!token || !product || !playerId || !selectedCredentialId) {
      setError(locale === 'ar' ? 'يرجى إدخال معرف اللاعب' : locale === 'tr' ? 'Oyuncu kimliğini giriniz' : 'Please enter the player ID');
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        credential_id: selectedCredentialId,
        game_id: product.id,
        coupon_id: product.coupon,
        player_identifier: playerId,
        customer_phone: phone,
      };
      const response = await fetchWithAuth<ZNetOrderResponse>(token, '/api/v1/providers/znet/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : locale === 'tr' ? 'Sipariş başarısız oldu' : 'فشل تنفيذ الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  if (!ready) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center">
        <p className="text-muted-foreground mb-4">{t('title')}</p>
        <Button onClick={() => connect()}>
          {locale === 'ar' ? 'سجل دخولك لعرض المنتج' : locale === 'tr' ? 'Ürünü görmek için giriş yapın' : 'Sign in to view product'}
        </Button>
      </div>
    );
  }

  if (!credentialReady) {
    return (
      <div className="bg-card border border-dashed rounded-2xl p-6 text-center">
        <p className="text-muted-foreground mb-4">
          {credentialLoading
            ? locale === 'ar'
              ? 'جاري تحميل بيانات الاعتماد...'
              : locale === 'tr'
              ? 'Kimlik bilgileri yükleniyor...'
              : 'Loading credentials...'
            : hasCredentials
            ? locale === 'ar'
              ? 'يرجى اختيار بيانات اعتماد ZNet من الصفحة الرئيسية'
              : locale === 'tr'
              ? 'Lütfen ana sayfadan bir ZNet hesabı seçin'
              : 'Please select a ZNet credential from the dashboard'
            : locale === 'ar'
            ? 'أضف بيانات اعتماد ZNet أولاً'
            : locale === 'tr'
            ? 'Önce ZNet kimliği ekleyin'
            : 'Add a ZNet credential first'}
        </p>
        <Button asChild>
          <Link href={`/${locale}`}>
            {locale === 'ar'
              ? 'العودة للوحة التحكم'
              : locale === 'tr'
              ? 'Panoya dön'
              : 'Return to dashboard'}
          </Link>
        </Button>
      </div>
    );
  }

  if (loading || !product) {
    return (
      <div className="text-center text-muted-foreground">
        {loading ? 'جاري تحميل المنتج...' : 'لا يوجد منتج مطابق'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
        <h1 className="text-2xl font-bold text-gold">{product.name}</h1>
        <p className="text-muted-foreground mt-2">{product.game}</p>
        <p className="text-lg font-semibold mt-4">{formatPrice(product.price_try)}</p>
      </div>

      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            {locale === 'ar' ? 'معرف اللاعب' : locale === 'tr' ? 'Oyuncu kimliği' : 'Player ID'}
          </label>
          <Input value={playerId} onChange={(e) => setPlayerId(e.target.value)} placeholder="123456789" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            {locale === 'ar' ? 'رقم الهاتف (اختياري)' : locale === 'tr' ? 'Telefon (opsiyonel)' : 'Phone (optional)'}
          </label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5XXXXXXXXX" />
        </div>
        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
        {result && (
          <div className="flex items-center gap-2 text-emerald-500 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            {locale === 'ar'
              ? `تم التنفيذ - التكلفة ${formatPrice(result.cost_try)} | الرصيد المتبقي ${formatPrice(result.remaining_balance)}`
              : locale === 'tr'
              ? `Başarılı - maliyet ${formatPrice(result.cost_try)} | kalan ${formatPrice(result.remaining_balance)}`
              : `Order placed - cost ${formatPrice(result.cost_try)} | remaining ${formatPrice(result.remaining_balance)}`}
          </div>
        )}
        <Button onClick={placeOrder} disabled={submitting} className="w-full">
          {submitting
            ? locale === 'ar'
              ? 'جاري تنفيذ الطلب...'
              : locale === 'tr'
              ? 'Sipariş gönderiliyor...'
              : 'Placing order...'
            : locale === 'ar'
            ? 'تنفيذ الطلب'
            : locale === 'tr'
            ? 'Siparişi gönder'
            : 'Place order'}
        </Button>
      </div>
    </div>
  );
}
