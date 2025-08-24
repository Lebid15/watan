'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';

interface User {
  email: string;
  role: string;
  balance: string;
  fullName?: string;
  phoneNumber?: string;
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    api
      .get<User>(API_ROUTES.auth.profile, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const userData = res.data;
        setUser(userData);

        // ✅ التحقق من الدور
        if (userData.role !== 'admin') {
          router.push('/admin/dashboard'); // صفحة المستخدم العادي لاحقًا
        }
      })
      .catch(() => {
        router.push('/login'); // لو فشل جلب البيانات يرجع لصفحة تسجيل الدخول
      });
  }, [router]);

  if (!user) return <p>جاري التحميل...</p>;

  return (
    <div>
      <h1 className="text-lg p-5 font-bold mb-3">لوحة تحكم المشرف</h1>
      <div className="space-y-2">
        <p>مرحباً، {user?.fullName || user?.email}</p>
        <p>هنا سنقدم جميع التعلميات الخاصة بالموضع</p>
        <p>أهلا وسهلا بكم دائماً.</p>

      </div>
    </div>
  );
}
