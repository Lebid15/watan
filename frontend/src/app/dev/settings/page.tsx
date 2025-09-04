'use client';
import Link from 'next/link';
import { Suspense } from 'react';

export const dynamic = 'force-dynamic'; // صفحة ديناميكية بالكامل، لا إعادة توليد ثابتة

function DevSettingsContent() {
  return (
    <div className="p-6" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">الإعدادات (Dev)</h1>
      <ul className="list-disc pr-6 space-y-2">
        <li>
          <Link href="/dev/settings/security" className="text-link">
            الأمان
          </Link>
        </li>
      </ul>
    </div>
  );
}

export default function DevSettingsIndex() {
  // لفّ المحتوى بـ Suspense حتى لو لم نستخدم useSearchParams هنا تحسبًا لازدياد التبعيات لاحقًا
  return <Suspense fallback={null}><DevSettingsContent /></Suspense>;
}
