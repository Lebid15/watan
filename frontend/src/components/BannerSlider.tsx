'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Banner {
  id: string;
  image_url: string;
  link?: string;
  order: number;
}

export default function BannerSlider() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  // جلب البانرات النشطة
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const tenantHost = window.location.hostname;
        const response = await fetch('http://127.0.0.1:8000/api-dj/banners/active/', {
          headers: {
            'X-Tenant-Host': tenantHost,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            setBanners(data.results);
          }
        }
      } catch (error) {
        console.error('Error fetching banners:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // التبديل التلقائي كل 5 ثوانٍ
  useEffect(() => {
    if (banners.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % banners.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [banners.length]);

  // إذا لم تكن هناك صور، لا تعرض أي شيء
  if (loading || banners.length === 0) {
    return null;
  }

  const currentBanner = banners[currentIndex];

  return (
    <div className="relative w-full px-4 sm:px-6 md:px-8 lg:px-12" dir="rtl">
      <div className="relative w-full rounded-lg overflow-hidden">
        {/* الصورة الحالية */}
        <div className="relative w-full h-40 sm:h-44 md:h-48 lg:h-52 xl:h-56">
          {currentBanner.link ? (
            <Link href={currentBanner.link} target="_blank">
              <img
                src={currentBanner.image_url}
                alt={`Banner ${currentIndex + 1}`}
                className="w-full h-full object-contain object-top cursor-pointer hover:scale-105 transition-transform duration-300"
              />
            </Link>
          ) : (
            <img
              src={currentBanner.image_url}
              alt={`Banner ${currentIndex + 1}`}
              className="w-full h-full object-contain object-top"
            />
          )}
        </div>
      </div>
    </div>
  );
}
