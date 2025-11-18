'use client';
import React, { useEffect, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import type { Announcement, AnnouncementsResponse } from '@/types/dashboard';
import AnnouncementCard from './AnnouncementCard';

const AnnouncementsList: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchAnnouncements = async () => {
      try {
        setLoading(true);
        setError(null);

        // محاولة جلب الإعلانات مع timeout قصير
        const response = await api.get<AnnouncementsResponse>(
          API_ROUTES.dashboard.announcements.active,
          { timeout: 3000 } // 3 seconds timeout فقط
        );

        if (!mounted) return;
        setAnnouncements(response.data.results || []);
      } catch (err: any) {
        console.error('Error fetching announcements:', err);
        if (!mounted) return;
        // في حالة الخطأ أو timeout، نعرض قائمة فارغة مباشرة
        setAnnouncements([]);
        setError(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // تأخير بسيط قبل البدء لتجنب race conditions
    const timer = setTimeout(fetchAnnouncements, 100);
    return () => { 
      mounted = false;
      clearTimeout(timer);
    };
  }, []);

  if (loading) {
    return (
      <div dir="rtl" className="flex items-center justify-center py-12 w-full">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-text-secondary">جاري تحميل الإعلانات...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div 
        dir="rtl"
        className="rounded-lg border-2 border-danger/30 bg-danger/10 p-6 text-center w-full"
      >
        <div className="text-4xl mb-3">⚠️</div>
        <h3 className="text-lg font-semibold text-danger mb-2">
          حدث خطأ
        </h3>
        <p className="text-sm text-danger/80">{error}</p>
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div 
        dir="rtl"
        className="rounded-lg border-2 border-border bg-bg-surface-alt p-8 sm:p-12 text-center w-full"
      >
        <div className="text-5xl sm:text-6xl mb-4">📭</div>
        <h3 className="text-lg sm:text-xl font-semibold text-text-primary mb-2">
          لا توجد إعلانات حالياً
        </h3>
        <p className="text-sm text-text-secondary">
          لم يتم نشر أي إعلانات في الوقت الحالي
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
          📢 الإعلانات والتحديثات
        </h2>
        <span className="rounded-full bg-primary/10 px-4 py-1 text-sm font-medium text-primary whitespace-nowrap">
          {announcements.length} إعلان
        </span>
      </div>

      <div className="flex flex-col gap-6 w-full">
        {announcements.map((announcement) => (
          <AnnouncementCard key={announcement.id} announcement={announcement} />
        ))}
      </div>
    </div>
  );
};

export default AnnouncementsList;
