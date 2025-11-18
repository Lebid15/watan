'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRouter, useParams } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';

interface User {
  id: string;
  email: string;
  username?: string | null;
  fullName?: string | null;
  phoneNumber?: string | null;
  countryCode?: string | null;
  role: string;
  isActive?: boolean;
  overdraftLimit?: number | null;
  address?: string;  // جديد
  documents?: string[];  // جديد
}

const COUNTRY_CODES = [
  { code: '+1',  label: 'US/CA (+1)' },
  { code: '+90', label: 'TR (+90)' },
  { code: '+213', label: 'DZ (+213)' },
  { code: '+966', label: 'SA (+966)' },
  { code: '+971', label: 'AE (+971)' },
  { code: '+974', label: 'QA (+974)' },
  { code: '+965', label: 'KW (+965)' },
  { code: '+973', label: 'BH (+973)' },
  { code: '+968', label: 'OM (+968)' },
  { code: '+962', label: 'JO (+962)' },
  { code: '+964', label: 'IQ (+964)' },
];

export default function EditUserPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const { id } = params as { id: string };

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [overdraft, setOverdraft] = useState<string>('');
  const [uploading, setUploading] = useState(false);  // جديد

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get(API_ROUTES.users.byId(id)) as any;
        setUser((res.data as any));
        setOverdraft(
          (res.data as any)?.overdraftLimit != null ? String((res.data as any).overdraftLimit) : ''
        );
      } catch {
        setError(t('users.error.load'));
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [id]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await api.put(API_ROUTES.users.byId(id), {
        fullName: user.fullName ?? null,
        username: user.username ?? null,
        phoneNumber: user.phoneNumber ?? null,
        countryCode: user.countryCode ?? null,
        address: user.address ?? '',  // جديد
      });

      if (newPassword.trim()) {
        await api.patch(API_ROUTES.users.setPassword(id), {
          password: newPassword.trim(),
        });
      }

      if (overdraft.trim()) {
        const val = Number(overdraft);
        if (!isNaN(val)) {
          await api.patch(API_ROUTES.users.setOverdraft(id), {
            overdraftLimit: val,
          });
        }
      }

      alert(t('users.detail.save.success'));
      router.push('/users');
    } catch {
      alert(t('users.detail.save.fail'));
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // التحقق من عدد الوثائق
    const currentDocs = user.documents || [];
    if (currentDocs.length >= 3) {
      alert('الحد الأقصى 3 وثائق');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', user.id);

      const res = await api.post('/api-dj/users/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }) as any;

      setUser({ ...user, documents: (res.data as any).documents });
      alert('تم رفع الوثيقة بنجاح');
    } catch {
      alert('فشل رفع الوثيقة');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteDocument = async (docUrl: string) => {
    if (!user || !confirm('هل تريد حذف هذه الوثيقة؟')) return;

    try {
      const res = await api.delete(`/api-dj/users/${user.id}/documents/delete`, {
        data: { documentUrl: docUrl },
      }) as any;

      setUser({ ...user, documents: (res.data as any).documents });
      alert('تم حذف الوثيقة بنجاح');
    } catch {
      alert('فشل حذف الوثيقة');
    }
  };
  
  if (loading) return <div className="p-4">{t('users.loading')}</div>;
  if (error) return <div className="p-4 text-danger">{error}</div>;
  if (!user) return <div className="p-4 text-danger">{t('users.detail.notFound')}</div>;

  return (
    <div className="p-6 max-w-xl mx-auto bg-bg-base text-text-primary min-h-screen rounded-lg">
  <h1 className="text-2xl font-bold mb-4">{t('users.detail.pageTitle')}</h1>

      {/* البريد */}
      <div className="mb-4">
  <label className="block font-semibold mb-1">{t('users.detail.email')}</label>
        <input
          type="email"
          value={user.email}
          disabled
          className="w-full border border-border p-2 rounded bg-bg-input cursor-not-allowed"
        />
      </div>

      {/* اسم المستخدم */}
      <div className="mb-4">
  <label className="block font-semibold mb-1">{t('users.detail.username')}</label>
        <input
          type="text"
          value={user.username ?? ''}
          onChange={(e) => setUser({ ...user, username: e.target.value })}
          className="w-full border border-border p-2 rounded bg-bg-input"
        />
      </div>

      {/* الاسم الكامل */}
      <div className="mb-4">
  <label className="block font-semibold mb-1">{t('users.detail.fullName')}</label>
        <input
          type="text"
          value={user.fullName ?? ''}
          onChange={(e) => setUser({ ...user, fullName: e.target.value })}
          className="w-full border border-border p-2 rounded bg-bg-input"
        />
      </div>

      {/* الهاتف */}
      <div className="mb-4">
  <label className="block font-semibold mb-1">{t('users.detail.phone')}</label>
        <div className="flex gap-2">
          <select
            value={user.countryCode ?? ''}
            onChange={(e) => setUser({ ...user, countryCode: e.target.value })}
            className="border border-border rounded p-2 bg-bg-input"
            style={{ minWidth: 120 }}
          >
            <option value="">{t('users.detail.phone.countryCodePlaceholder')}</option>
            {COUNTRY_CODES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="tel"
            value={user.phoneNumber ?? ''}
            onChange={(e) => setUser({ ...user, phoneNumber: e.target.value })}
            className="flex-1 border border-border rounded p-2 bg-bg-input"
          />
        </div>
      </div>

      {/* الدور والحالة غير قابلة للتعديل من هذه الصفحة */}

      {/* كلمة السر */}
      <div className="mb-4">
  <label className="block font-semibold mb-1">{t('users.detail.password.label')}</label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border border-border p-2 rounded bg-bg-input"
          placeholder={t('users.detail.password.placeholder')}
        />
      </div>

      {/* حد السالب */}
      <div className="mb-6">
  <label className="block font-semibold mb-1">{t('users.detail.overdraft.label')}</label>
        <input
          type="number"
          step="0.01"
          value={overdraft}
          onChange={(e) => setOverdraft(e.target.value)}
          className="w-full border border-border p-2 rounded bg-bg-input"
          placeholder={t('users.detail.overdraft.placeholder')}
        />
        <p className="text-xs text-text-secondary mt-1">{t('users.detail.overdraft.help')}</p>
      </div>

      {/* العنوان الكامل */}
      <div className="mb-4">
        <label className="block font-semibold mb-1">العنوان الكامل</label>
        <textarea
          value={user.address ?? ''}
          onChange={(e) => setUser({ ...user, address: e.target.value })}
          className="w-full border border-border p-2 rounded bg-bg-input"
          rows={3}
          placeholder="أدخل العنوان الكامل..."
        />
      </div>

      {/* الوثائق (رفع الصور) */}
      <div className="mb-6">
        <label className="block font-semibold mb-2">الوثائق (حد أقصى 3 صور)</label>
        
        {/* عرض الوثائق الحالية */}
        {user.documents && user.documents.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-3">
            {user.documents.map((doc, idx) => (
              <div key={idx} className="relative border border-border rounded overflow-hidden">
                <img 
                  src={doc} 
                  alt={`وثيقة ${idx + 1}`}
                  className="w-full h-32 object-cover"
                />
                <button
                  onClick={() => handleDeleteDocument(doc)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-700"
                  title="حذف"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* زر رفع وثيقة جديدة */}
        {(!user.documents || user.documents.length < 3) && (
          <div>
            <input
              type="file"
              id="document-upload"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            <label
              htmlFor="document-upload"
              className={`inline-block bg-bg-surface-alt text-text-primary px-4 py-2 rounded border border-border cursor-pointer hover:opacity-90 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {uploading ? '⏳ جاري الرفع...' : '📎 رفع وثيقة'}
            </label>
            <p className="text-xs text-text-secondary mt-1">
              الملفات المدعومة: JPG, PNG, GIF, WebP
            </p>
          </div>
        )}
      </div>

      {/* الأزرار */}
      <div className="flex gap-4">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="bg-primary text-primary-contrast px-4 py-2 rounded hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? t('users.detail.save.saving') : t('users.detail.save.button')}
        </button>
        <button
          onClick={() => router.back()}
          className="bg-bg-surface-alt text-text-primary px-4 py-2 rounded border border-border hover:opacity-90"
        >
          {t('users.detail.back')}
        </button>
      </div>
    </div>
  );
}
