'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AnnouncementsList from '@/components/admin/AnnouncementsList';

interface User {
  email: string;
  role: string;
  balance: string;
  fullName?: string;
  phoneNumber?: string;
}

// Mock user data
const MOCK_USER: User = {
  email: 'admin@example.com',
  role: 'admin',
  balance: '1000.00',
  fullName: 'مدير النظام',
  phoneNumber: '+963123456789'
};

export default function AdminDashboardPageClient() {
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setUser(MOCK_USER);
    }, 500);
    return () => clearTimeout(timer);
  }, [router]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-text-secondary">جاري التحميل...</p>
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
        <h1 className="text-base sm:text-lg font-bold flex items-center gap-3">
          <span>👋</span>
          <span>أهلاً وسهلاً بك في لوحة الإعلانات</span>
        </h1>
      </div>

      {/* Announcements Section */}
      <div className="rounded-lg bg-bg-surface border border-border p-4 sm:p-6 shadow-md w-full">
        <AnnouncementsList />
      </div>
    </div>
  );
}
