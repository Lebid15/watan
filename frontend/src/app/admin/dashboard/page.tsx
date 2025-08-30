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
        // أزلنا إعادة التوجيه الذاتي لتفادي loop عند أدوار غير admin (مثل tenant_owner)
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  if (!user) return <p>جاري التحميل...</p>;

  return (
    <div>
      <h1 className="text-lg p-5 font-bold mb-3">لوحة تحكم المشرف</h1>
      <div className="space-y-2">
        <p>مرحباً، {user?.fullName || user?.email}</p>
        <p>هنا سنقدم جميع التعلميات الخاصة بالموضع4</p>
        <p>أهلا وسهلا بكم دائماً.</p>

      </div>
    </div>
  );
}
