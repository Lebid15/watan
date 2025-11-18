'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useState } from 'react';

interface PaymentMethod {
  id: string;
  nameAr: string;
  nameEn: string;
  nameTr: string;
  image: string;
}

export default function AddBalancePage() {
  const t = useTranslations('AddBalance');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  const paymentMethods: PaymentMethod[] = [
    {
      id: 'tawasol-box',
      nameAr: 'صندوق تواصل',
      nameEn: 'Tawasol Box',
      nameTr: 'Tawasol Kutusu',
      image: '/images/tawasol_box.png',
    },
    {
      id: 'kuwait-turk',
      nameAr: 'كويت ترك بنك',
      nameEn: 'Kuwait Turk Bank',
      nameTr: 'Kuveyt Türk Bankası',
      image: '/images/kuvwaitturk.png',
    },
    {
      id: 'pay-by-hand',
      nameAr: 'تسليم باليد',
      nameEn: 'Pay by Hand',
      nameTr: 'Elden Ödeme',
      image: '/images/paybyhand.png',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <h1 className="text-2xl md:text-3xl font-bold text-gold">
        {t('title')}
      </h1>

      {/* Payment Methods Grid - Same as Products */}
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {paymentMethods.map((method) => (
          <div
            key={method.id}
            onClick={() => setSelectedMethod(method.id)}
            className="group relative cursor-pointer"
          >
            {/* Selected Badge */}
            {selectedMethod === method.id && (
              <div className="absolute top-2 left-2 z-10">
                <span className="text-white text-xs px-2 py-1 rounded-md shadow-lg" style={{ backgroundColor: 'var(--gold)' }}>
                  محدد
                </span>
              </div>
            )}

            {/* Payment Method Image */}
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br from-beige-100 to-beige-200 dark:from-neutral-800 dark:to-neutral-900 group-hover:scale-105 transition-transform duration-500 shadow-md group-hover:shadow-xl border-2 border-transparent group-hover:border-gold">
              <Image
                src={method.image}
                alt={method.nameAr}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, 16vw"
              />
              
              {/* Shine Effect */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 group-hover:translate-x-full transform -translate-x-full"></div>
            </div>

            {/* Payment Method Name */}
            <h3 className="mt-2 text-sm md:text-base font-semibold text-center group-hover:text-gold transition-colors line-clamp-1">
              {method.nameAr}
            </h3>
          </div>
        ))}
      </div>

      {/* Selected Method Info */}
      {selectedMethod && (
        <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--beige)' }}>
          <p className="text-center text-sm md:text-base">
            {t('selected')}: <strong style={{ color: 'var(--gold)' }}>
              {paymentMethods.find((m) => m.id === selectedMethod)?.nameAr}
            </strong>
          </p>
        </div>
      )}
    </div>
  );
}
