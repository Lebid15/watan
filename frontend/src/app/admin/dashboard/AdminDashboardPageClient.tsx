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

export default function AdminDashboardPageClient() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    const token = (typeof window !== 'undefined') ? localStorage.getItem('token') : null;
    if (!token) {
      router.push('/login');
      return;
    }
    api.get<User>(API_ROUTES.auth.profile, { headers: { Authorization: `Bearer ${token}` } })
      .then(res => { if (!mounted) return; setUser(res.data); })
      .catch(() => { if (!mounted) return; router.push('/login'); });
    return () => { mounted = false; };
  }, [router]);

  if (!user) return <p>جاري التحميل...</p>;

  return (
    <div>
      <h1 className="text-lg p-5 font-bold mb-3">لوحة تحكم المشرف</h1>
      <div className="space-y-2">
        <p>مرحباً، {user?.fullName || user?.email}</p>
        <p>هنا سنقدم جميع التعلميات الخاصة بالموضع87</p>
        <p>أهلا وسهلا بكم دائماً.</p>
      </div>
    </div>
  );
}
