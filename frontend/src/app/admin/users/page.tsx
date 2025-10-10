// src/app/admin/users/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import api, { API_ROUTES } from '@/utils/api';
import { currencySymbol, formatMoney } from '@/utils/format';

interface UserRow {
  id: string;
  email: string;
  username?: string | null;
  role: string;
  balance: number | string | null;
  currency?: { id: string; code: string } | null;
  isActive?: boolean;
  fullName?: string | null;
  phoneNumber?: string | null;
}

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');

  // حالة نافذة الإضافة (+)
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupUser, setTopupUser] = useState<UserRow | null>(null);
  const [topupAmount, setTopupAmount] = useState<string>('');
  const [methods, setMethods] = useState<{ id: string; name: string; type?: string; isActive?: boolean }[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [topupNote, setTopupNote] = useState<string>('');

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await api.get<UserRow[]>(API_ROUTES.users.base);
      setUsers(res.data);
      setError('');
    } catch {
  setError(t('users.error.load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // جلب هوية المستخدم الحالي لاستبعاده من القائمة
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get<any>(API_ROUTES.users.profileWithCurrency);
        if (data?.id) setCurrentUserId(String(data.id));
      } catch {}
    })();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm(t('users.confirm.delete'))) return;
    try {
      await api.delete(API_ROUTES.users.byId(id));
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      alert(t('users.delete.fail'));
    }
  };

  const handleToggleActive = async (u: UserRow) => {
    try {
      const next = !(u.isActive ?? true);
      await api.patch(API_ROUTES.users.toggleActive(u.id), { isActive: next });
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, isActive: next } : x))
      );
    } catch {
      alert(t('users.status.toggle.fail'));
    }
  };

  // فتح مودال الإضافة — نجلب بيانات المستخدم محدثة (اسم، رصيد، عملة)
  const openTopup = async (u: UserRow) => {
    try {
      const { data } = await api.get<UserRow>(API_ROUTES.users.byId(u.id));
      setTopupUser({
        ...u,
        ...data, // يضمن username / balance / currency الأحدث
      });
    } catch {
      // لو فشل الجلب نستخدم بيانات الصف الحالية
      setTopupUser(u);
    }
    setTopupAmount('');
    setSelectedMethodId('');
    setTopupNote('');
    // fetch active payment methods (admin)
    try {
      const { data } = await api.get<any[]>(API_ROUTES.admin.paymentMethods.base);
      const active = (data || []).filter((m) => m.isActive !== false);
      setMethods(active);
    } catch {
      setMethods([]);
    }
    setTopupOpen(true);
  };

  const confirmTopup = async () => {
    if (!topupUser) return;
    const amount = Number(topupAmount);
    if (!amount || isNaN(amount)) {
      alert(t('users.topup.errors.invalidAmount'));
      return;
    }
    if (!selectedMethodId) {
      alert(t('users.topup.errors.methodRequired'));
      return;
    }
    
    const payload = {
      userId: topupUser.id,
      amount,
      methodId: selectedMethodId,
      note: topupNote?.trim() ? topupNote.trim() : undefined,
    };
    
    console.log('[TOPUP] Sending payload:', payload);
    
    try {
      const response = await api.post(API_ROUTES.admin.deposits.topup, payload);
      console.log('[TOPUP] Success:', response.data);
      setTopupOpen(false);
      setTopupUser(null);
      setTopupAmount('');
      setSelectedMethodId('');
      setTopupNote('');
      await loadUsers();
    } catch (error: any) {
      console.error('[TOPUP] Error:', error.response?.data || error.message);
      alert(t('users.topup.errors.fail') + ': ' + (error.response?.data?.error || error.response?.data?.message || error.message));
    }
  };

  const handleReset2FA = async (userId: string) => {
    if (!confirm(t('users.2fa.reset.confirm'))) {
      return;
    }

    try {
      await api.post(`/auth/totp/reset/${userId}`);
      alert(t('users.2fa.reset.success'));
    } catch (error: any) {
      alert(error?.response?.data?.message || t('users.2fa.reset.fail'));
    }
  };

  const filtered = users.filter((u) => {
    if (currentUserId && u.id === currentUserId) return false; // استثناء مالك الساب دومين (أو المستخدم الحالي)
    // استثناء المستخدمين الافتراضيين (seed / system) من العرض
    const SEED_EMAILS = [
      'owner@example.com',
      'dev@example.com',
      'alayatl.tr@gmail.com',
      'lebidhacalayebank@gmail.com',
    ];
    if (SEED_EMAILS.includes(u.email.toLowerCase())) return false;
    const t = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(t) ||
      (u.username ?? '').toLowerCase().includes(t) ||
      (u.fullName ?? '').toLowerCase().includes(t) ||
      (u.phoneNumber ?? '').toLowerCase().includes(t)
    );
  });

  return (
    <div className="bg-bg-base text-text-primary p-6 min-h-screen">
      <h1 className="font-bold mb-4">{t('users.pageTitle')}</h1>
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          placeholder={t('users.search.placeholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border rounded px-3 py-2 w-80 bg-bg-input"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="bg-bg-surface-alt border border-border text-text-primary px-3 py-2 rounded hover:opacity-90"
          >
            {t('users.search.clear')}
          </button>
        )}
      </div>

      {error && <div className="text-danger mb-3">{error}</div>}
      {loading ? (
        <div>{t('users.loading')}</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-bg-surface">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-bg-surface-alt text-center">
                  <th className="border border-border p-2">{t('users.table.username')}</th>
                  {/** مخفي بناءً على طلب: عمود البريد الإلكتروني */}
                  {/** <th className="border border-border p-2">البريد الإلكتروني</th> */}
                  <th className="border border-border p-2">{t('users.table.balance')}</th>
                  <th className="border border-border p-2">{t('users.table.status')}</th>
                  {/* تقليل الحشو في ترويسة الإجراءات */}
                  <th className="border border-border px-2 py-1">{t('users.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const num = Number(u.balance);
                  const code = u.currency?.code;
                  const sym = currencySymbol(code || undefined);
                  const balanceDisplay =
                    u.balance !== null && !isNaN(num)
                      ? formatMoney(num, code, {
                          symbolBefore: sym === '$' || sym === '€',
                        })
                      : '-';
                  const isActive = u.isActive ?? true;

                  return (
                    <tr key={u.id} className="text-center hover:bg-bg-surface-alt">
                      <td className="border border-border p-2">{u.username ?? '-'}</td>
                      {/** مخفي بناءً على طلب: عمود البريد الإلكتروني */}
                      {/** <td className="border border-border p-2">{u.email}</td> */}
                      <td className="border border-border p-2">{balanceDisplay}</td>
                      <td className="border border-border p-2">
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`w-4 h-4 rounded-full inline-block ${
                            isActive
                              ? 'bg-success hover:opacity-90'
                              : 'bg-danger hover:opacity-90'
                          }`}
                          title={isActive ? t('users.status.active') : t('users.status.inactive')}
                        />
                      </td>
                      <td className="border border-border px-1.5 py-1">
                        <div className="flex justify-center gap-1.5">
                          <button
                            onClick={() => openTopup(u)}
                            className="bg-success text-text-inverse px-2.5 py-0.5 rounded hover:brightness-110 text-sm"
                            title={t('users.topup.submit')}
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleReset2FA(u.id)}
                            className="bg-red-600 text-white px-2.5 py-0.5 rounded hover:bg-red-700 text-[11px]"
                            title={t('users.2fa.reset.button')}
                          >
                            {t('users.2fa.reset.button')}
                          </button>
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="bg-primary text-primary-contrast px-2.5 py-0.5 rounded hover:bg-primary-hover text-sm"
                          >
                            {t('users.actions.edit')}
                          </Link>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="bg-danger text-text-inverse px-2.5 py-0.5 rounded hover:brightness-110 text-sm"
                          >
                            {t('users.actions.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div className="text-text-secondary mt-4">{t('users.empty.filtered')}</div>
          )}
        </>
      )}

      {/* نافذة إضافة رصيد */}
      {topupOpen && topupUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-surface text-text-primary border border-border rounded-lg p-5 w-full max-w-md">
            <h2 className="text-lg font-bold mb-3">{t('users.topup.title')}</h2>

            {/* اسم المستخدم أو الإيميل */}
            <div className="mb-2 text-sm">
              {t('users.topup.user')}: 
              <span className="font-semibold">
                {topupUser.username?.trim() ? topupUser.username : topupUser.email}
              </span>
            </div>

            {/* عملة المستخدم بالرمز والكود */}
            <div className="mb-2 text-sm">
              {t('users.topup.currency')}: 
              <span className="font-semibold">
                {currencySymbol(topupUser.currency?.code || undefined)}{' '}
                ({topupUser.currency?.code ?? '-'})
              </span>
            </div>

            {/* الرصيد السابق */}
            <div className="mb-4 text-sm">
              {t('users.topup.previousBalance')}: 
              <span className="font-semibold">
                {topupUser.balance !== null
                  ? formatMoney(Number(topupUser.balance), topupUser.currency?.code, {
                      symbolBefore:
                        currencySymbol(topupUser.currency?.code || undefined) === '$' ||
                        currencySymbol(topupUser.currency?.code || undefined) === '€',
                    })
                  : '-'}
              </span>
            </div>

            <div className="mb-4">
              <label className="block mb-1">{t('users.topup.amount.label')}</label>
              <input
                type="number"
                step="0.0001"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="w-full bg-bg-input border border-border px-3 py-2 rounded"
                placeholder={t('users.topup.amount.example', { symbol: currencySymbol(topupUser.currency?.code || undefined) })}
                inputMode="decimal"
              />
            </div>

            <div className="mb-4">
              <label className="block mb-1">{t('users.topup.method.label')}<span className="text-danger"> *</span></label>
              <select
                value={selectedMethodId}
                onChange={(e) => setSelectedMethodId(e.target.value)}
                className="w-full bg-bg-input border border-border px-3 py-2 rounded"
              >
                <option value="">{t('users.topup.method.placeholder')}</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block mb-1">{t('users.topup.note.label')}</label>
              <textarea
                value={topupNote}
                onChange={(e) => setTopupNote(e.target.value)}
                rows={2}
                className="w-full bg-bg-input border border-border px-3 py-2 rounded resize-none"
                placeholder={t('users.topup.note.placeholder')}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={confirmTopup}
                className="px-4 py-2 rounded bg-success text-text-inverse hover:brightness-110"
              >
                {t('users.topup.submit')}
              </button>
              <button
                onClick={() => {
                  setTopupOpen(false);
                  setTopupUser(null);
                  setTopupAmount('');
                }}
                className="px-4 py-2 rounded bg-bg-surface-alt border border-border hover:opacity-90"
              >
                {t('users.topup.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
