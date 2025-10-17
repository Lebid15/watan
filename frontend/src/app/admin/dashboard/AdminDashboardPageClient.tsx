'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';
import AnnouncementsList from '@/components/admin/AnnouncementsList';

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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div 
        dir="rtl"
        className="rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 p-6 sm:p-8 text-white shadow-lg w-full"
      >
        <h1 className="text-lg sm:text-xl font-bold flex items-center gap-3">
          <span>👋</span>
          <span>أهلاً وسهلاً بك في لوحة الإعلانات</span>
        </h1>
      </div>

      {/* Announcements Section */}
      <div className="rounded-lg bg-white dark:bg-gray-800 p-4 sm:p-6 shadow-md w-full">
        <AnnouncementsList />
      </div>
    </div>
  );
}
