'use client';

import Link from 'next/link';

export default function Page() {
  return (
    <div className="p-4" dir="rtl">
      <h1 className="text-lg font-bold mb-3">القائمة</h1>
      <ul className="list-disc pr-5 space-y-2">
        <li><Link href="/orders" className="text-link">طلباتي</Link></li>
        <li><Link href="/wallet" className="text-link">المحفظة</Link></li>
        <li><Link href="/user/infoes" className="text-link">تعليمات</Link></li>
      </ul>
    </div>
  );
}
