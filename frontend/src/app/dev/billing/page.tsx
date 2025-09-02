'use client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
import Link from 'next/link';

export default function DevBillingHub(){
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing (Dev)</h1>
      <p className="text-sm text-gray-600">لوحة فحص الفوترة الإصدار V1 (عرض المطور فقط). هذه الصفحة تعرض روابط للصفحات نفسها كما يراها التينانت لكن دون قيود التينانت لتسهيل الاختبار.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/billing/overview" className="p-4 rounded border hover:bg-gray-50 block">Overview</Link>
        <Link href="/billing/invoices" className="p-4 rounded border hover:bg-gray-50 block">Invoices</Link>
        <Link href="/billing/pay" className="p-4 rounded border hover:bg-gray-50 block">Pay</Link>
      </div>
      <div className="text-xs text-gray-500">If NEXT_PUBLIC_FEATURE_BILLING_V1=false سيتم إخفاء هذا المسار في الـ Navbar.</div>
      <div className="text-[10px] text-gray-400">build sanity marker: DEV_BILLING_PAGE_LOADED</div>
    </div>
  );
}
