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

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await api.get<User>(API_ROUTES.users.byId(id));
        setUser(res.data);
        setOverdraft(
          res.data?.overdraftLimit != null ? String(res.data.overdraftLimit) : ''
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
        role: user.role,
        isActive: user.isActive,
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
      router.push('/admin/users');
    } catch {
      alert(t('users.detail.save.fail'));
    } finally {
      setSaving(false);
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

      {/* الدور */}
      <div className="mb-4">
  <label className="block font-semibold mb-1">{t('users.detail.role')}</label>
        <select
          value={user.role}
          onChange={(e) => setUser({ ...user, role: e.target.value })}
          className="w-full border border-border p-2 rounded bg-bg-input"
        >
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </div>

      {/* الحالة */}
      <div className="mb-4">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={user.isActive ?? true}
            onChange={(e) => setUser({ ...user, isActive: e.target.checked })}
          />
          <span>{t('users.detail.activeCheckbox')}</span>
        </label>
      </div>

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
