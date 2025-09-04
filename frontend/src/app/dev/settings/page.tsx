'use client';
import Link from 'next/link';

export default function DevSettingsIndex(){
  return (
    <div className="p-6" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">الإعدادات (Dev)</h1>
      <ul className="list-disc pr-6 space-y-2">
        <li><Link href="/dev/settings/security" className="text-link">الأمان</Link></li>
      </ul>
    </div>
  );
}
