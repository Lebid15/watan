'use client';
import Link from 'next/link';
import { useUser } from '@/context/UserContext';

export default function Page() {
  const { user } = useUser();
  // نعرض رابط الأمان فقط للمستخدم النهائي role === 'user'
  const isEndUser = user?.role === 'user';
  return (
    <div className="p-4" dir="rtl">
      <h1 className="text-lg font-bold mb-3">القائمة</h1>
      <ul className="list-disc pr-5 space-y-2">
        <li><Link href="/orders" className="text-link">طلباتي</Link></li>
        <li><Link href="/wallet" className="text-link">المحفظة</Link></li>
        {isEndUser && <li><Link href="/security" className="text-link">الأمان</Link></li>}
        <li><Link href="/user/infoes" className="text-link">تعليمات</Link></li>
      </ul>
    </div>
  );
}
