"use client";
import Link from 'next/link';
import { useT } from '@/i18n';

export default function SuspendedBanner() {
  const t=useT();
  return (
    <div className="bg-red-700 text-white p-3 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded">
      <div>{t('billing.suspended.banner')}</div>
      <div className="flex gap-2">
        <Link href="/billing/overview" className="bg-black/30 hover:bg-black/40 px-3 py-1 rounded">{t('nav.api') /* reuse or add a billing overview key later */}</Link>
        <Link href="/billing/pay" className="bg-white text-red-700 hover:opacity-80 px-3 py-1 rounded font-semibold">{t('billing.suspended.payRequestButton')}</Link>
      </div>
    </div>
  );
}
