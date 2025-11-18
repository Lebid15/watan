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
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // جلب البانرات
  const fetchBanners = async () => {
    setLoading(true);
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
      // تجاهل الخطأ بصمت إذا كان API غير متوفر
      setBanners([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // لا نقوم بالتحميل التلقائي لتجنب الأخطاء
    // fetchBanners();
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
      <div className="min-h-screen bg-bg-base p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-text-secondary">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            🎨 إدارة صور السلايدر
          </h1>
          <p className="text-text-secondary">
            يمكنك إضافة حتى 3 صور تظهر في الصفحة الرئيسية لمستخدميك
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg border-2 ${
              message.type === 'success'
                ? 'bg-success/10 text-success border-success/30'
                : 'bg-danger/10 text-danger border-danger/30'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Upload Section */}
        <div className="bg-bg-surface border border-border rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-text-primary mb-4">
            ➕ إضافة صورة جديدة
          </h2>
          
          <div className="flex items-center gap-4">
            <label
              className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                banners.length >= 3
                  ? 'border-border bg-bg-surface-alt cursor-not-allowed'
                  : 'border-primary/30 hover:border-primary hover:bg-primary/5'
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
              <span className="text-text-primary font-medium">
                {uploading ? 'جاري الرفع...' : banners.length >= 3 ? 'تم الوصول للحد الأقصى (3 صور)' : 'اختر صورة للرفع'}
              </span>
            </label>
          </div>

          <p className="mt-3 text-sm text-text-secondary">
            💡 الصور المدعومة: JPG, PNG, GIF | الحد الأقصى للحجم: 5MB | عدد الصور: {banners.length}/3
          </p>
        </div>

        {/* Banners List */}
        <div className="space-y-4">
          {banners.length === 0 ? (
            <div className="bg-bg-surface border border-border rounded-lg shadow-sm p-12 text-center">
              <div className="text-6xl mb-4">🖼️</div>
              <h3 className="text-xl font-semibold text-text-primary mb-2">
                لا توجد صور بعد
              </h3>
              <p className="text-text-secondary">
                ابدأ بإضافة أول صورة للسلايدر
              </p>
            </div>
          ) : (
            banners.map((banner, index) => (
              <div
                key={banner.id}
                className="bg-bg-surface border border-border rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-6">
                  {/* Order Number */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">
                        {index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Image Preview */}
                  <div className="flex-shrink-0">
                    <img
                      src={banner.image_url}
                      alt={`Banner ${index + 1}`}
                      className="w-48 h-28 object-cover rounded-lg border-2 border-border"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-lg font-semibold text-text-primary">
                        صورة السلايدر {index + 1}
                      </h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          banner.is_active
                            ? 'bg-success/10 text-success'
                            : 'bg-bg-surface-alt text-text-secondary'
                        }`}
                      >
                        {banner.is_active ? '✅ نشط' : '⏸️ متوقف'}
                      </span>
                    </div>

                    {/* Link Input */}
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-text-primary mb-2">
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
                        className="w-full px-4 py-2 border border-border rounded-lg bg-bg-input text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-transparent"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleToggleActive(banner)}
                        className="px-4 py-2 bg-primary hover:bg-primary-hover text-primary-contrast rounded-lg font-medium transition-colors"
                      >
                        {banner.is_active ? '⏸️ إيقاف' : '▶️ تفعيل'}
                      </button>
                      <button
                        onClick={() => handleDelete(banner.id)}
                        className="px-4 py-2 bg-danger hover:bg-danger-hover text-white rounded-lg font-medium transition-colors"
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
