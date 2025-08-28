"use client";
import Link from 'next/link';

export default function SuspendedBanner() {
  return (
    <div className="bg-red-700 text-white p-3 text-sm flex flex-col gap-2 md:flex-row md:items-center md:justify-between rounded">
      <div>تم تعليق المتجر بسبب تأخر الدفع.</div>
      <div className="flex gap-2">
        <Link href="/billing/overview" className="bg-black/30 hover:bg-black/40 px-3 py-1 rounded">الفوترة</Link>
        <Link href="/billing/pay" className="bg-white text-red-700 hover:opacity-80 px-3 py-1 rounded font-semibold">طلب دفع</Link>
      </div>
    </div>
  );
}
