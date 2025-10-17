'use client';

import { useEffect, useState } from 'react';

interface Banner {
  id: string;
  image: string;
  image_url: string;
  order: number;
  is_active: boolean;
  link?: string;
  created_at: string;
}

export default function BannersSettingsPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // جلب البانرات
  const fetchBanners = async () => {
    try {
      const tenantHost = window.location.hostname;
      const response = await fetch('http://127.0.0.1:8000/api-dj/banners/', {
        headers: {
          'X-Tenant-Host': tenantHost,
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBanners(data.sort((a: Banner, b: Banner) => a.order - b.order));
      }
    } catch (error) {
      console.error('Error fetching banners:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  // رفع صورة جديدة
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من عدد البانرات
    if (banners.length >= 3) {
      setMessage({ type: 'error', text: 'الحد الأقصى 3 صور فقط' });
      return;
    }

    // التحقق من نوع الملف
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'يجب اختيار صورة فقط' });
      return;
    }

    // التحقق من حجم الملف (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'حجم الصورة يجب أن لا يتجاوز 5MB' });
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('order', banners.length.toString());
      formData.append('is_active', 'true');

      const tenantHost = window.location.hostname;
      const response = await fetch('http://127.0.0.1:8000/api-dj/banners/', {
        method: 'POST',
        headers: {
          'X-Tenant-Host': tenantHost,
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'تم رفع الصورة بنجاح ✅' });
        fetchBanners();
      } else {
        const error = await response.json();
        setMessage({ type: 'error', text: error.detail || 'حدث خطأ أثناء رفع الصورة' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' });
    } finally {
      setUploading(false);
    }
  };

  // حذف بانر
  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الصورة؟')) return;

    try {
      const tenantHost = window.location.hostname;
      const response = await fetch(`http://127.0.0.1:8000/api-dj/banners/${id}/`, {
        method: 'DELETE',
        headers: {
          'X-Tenant-Host': tenantHost,
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'تم حذف الصورة بنجاح ✅' });
        fetchBanners();
      } else {
        setMessage({ type: 'error', text: 'حدث خطأ أثناء الحذف' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'حدث خطأ في الاتصال' });
    }
  };

  // تفعيل/إلغاء تفعيل بانر
  const handleToggleActive = async (banner: Banner) => {
    try {
      const formData = new FormData();
      formData.append('is_active', (!banner.is_active).toString());

      const tenantHost = window.location.hostname;
      const response = await fetch(`http://127.0.0.1:8000/api-dj/banners/${banner.id}/`, {
        method: 'PATCH',
        headers: {
          'X-Tenant-Host': tenantHost,
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'تم تحديث الحالة بنجاح ✅' });
        fetchBanners();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'حدث خطأ في التحديث' });
    }
  };

  // تحديث الرابط
  const handleUpdateLink = async (banner: Banner, newLink: string) => {
    try {
      const formData = new FormData();
      formData.append('link', newLink);

      const tenantHost = window.location.hostname;
      const response = await fetch(`http://127.0.0.1:8000/api-dj/banners/${banner.id}/`, {
        method: 'PATCH',
        headers: {
          'X-Tenant-Host': tenantHost,
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'تم تحديث الرابط بنجاح ✅' });
        fetchBanners();
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'حدث خطأ في التحديث' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🎨 إدارة صور السلايدر
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            يمكنك إضافة حتى 3 صور تظهر في الصفحة الرئيسية لمستخدميك
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            ➕ إضافة صورة جديدة
          </h2>
          
          <div className="flex items-center gap-4">
            <label
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                banners.length >= 3
                  ? 'border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 cursor-not-allowed'
                  : 'border-blue-300 dark:border-blue-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              }`}
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                disabled={uploading || banners.length >= 3}
                className="hidden"
              />
              <span className="text-2xl">📤</span>
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                {uploading ? 'جاري الرفع...' : banners.length >= 3 ? 'تم الوصول للحد الأقصى (3 صور)' : 'اختر صورة للرفع'}
              </span>
            </label>
          </div>

          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            💡 الصور المدعومة: JPG, PNG, GIF | الحد الأقصى للحجم: 5MB | عدد الصور: {banners.length}/3
          </p>
        </div>

        {/* Banners List */}
        <div className="space-y-4">
          {banners.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-12 text-center">
              <div className="text-6xl mb-4">🖼️</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                لا توجد صور بعد
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                ابدأ بإضافة أول صورة للسلايدر
              </p>
            </div>
          ) : (
            banners.map((banner, index) => (
              <div
                key={banner.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-6">
                  {/* Order Number */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Image Preview */}
                  <div className="flex-shrink-0">
                    <img
                      src={banner.image_url}
                      alt={`Banner ${index + 1}`}
                      className="w-48 h-28 object-cover rounded-lg border-2 border-gray-200 dark:border-gray-700"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        صورة السلايدر {index + 1}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          banner.is_active
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {banner.is_active ? '✅ نشط' : '⏸️ متوقف'}
                      </span>
                    </div>

                    {/* Link Input */}
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        🔗 الرابط (اختياري)
                      </label>
                      <input
                        type="url"
                        defaultValue={banner.link || ''}
                        onBlur={(e) => {
                          if (e.target.value !== banner.link) {
                            handleUpdateLink(banner, e.target.value);
                          }
                        }}
                        placeholder="https://example.com"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleToggleActive(banner)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        {banner.is_active ? '⏸️ إيقاف' : '▶️ تفعيل'}
                      </button>
                      <button
                        onClick={() => handleDelete(banner.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                      >
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
