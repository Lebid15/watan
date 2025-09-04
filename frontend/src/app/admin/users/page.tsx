// src/app/admin/users/page.tsx
'use client';

import { useEffect, useState } from 'react';
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
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

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
      setError('فشل تحميل بيانات المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا المستخدم؟')) return;
    try {
      await api.delete(API_ROUTES.users.byId(id));
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      alert('فشل حذف المستخدم');
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
      alert('تعذّر تغيير الحالة');
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
      alert('أدخل مبلغًا صحيحًا');
      return;
    }
    if (!selectedMethodId) {
      alert('اختر وسيلة الدفع');
      return;
    }
    try {
      await api.post(API_ROUTES.admin.deposits.topup, {
        userId: topupUser.id,
        amount,
        methodId: selectedMethodId,
        note: topupNote?.trim() ? topupNote.trim() : undefined,
      });
      setTopupOpen(false);
      setTopupUser(null);
      setTopupAmount('');
      setSelectedMethodId('');
      setTopupNote('');
      await loadUsers();
    } catch {
      alert('فشل إضافة الرصيد');
    }
  };

  const handleReset2FA = async (userId: string) => {
    if (!confirm('هل أنت متأكد من إعادة تعيين المصادقة الثنائية لهذا المستخدم؟ سيتم إجباره على إعداد المصادقة من جديد.')) {
      return;
    }

    try {
      await api.post(`/auth/totp/reset/${userId}`);
      alert('تم إعادة تعيين المصادقة الثنائية بنجاح');
    } catch (error: any) {
      alert(error?.response?.data?.message || 'فشل في إعادة تعيين المصادقة الثنائية');
    }
  };

  const filtered = users.filter((u) => {
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
      <h1 className="font-bold mb-4">المستخدمون</h1>
      <div className="mb-4 flex items-center gap-2">
        <input
          type="text"
          placeholder="ابحث بالبريد / الاسم / الجوال..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-border rounded px-3 py-2 w-80 bg-bg-input"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="bg-bg-surface-alt border border-border text-text-primary px-3 py-2 rounded hover:opacity-90"
          >
            مسح
          </button>
        )}
      </div>

      {error && <div className="text-danger mb-3">{error}</div>}
      {loading ? (
        <div>جارٍ التحميل...</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-bg-surface">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-bg-surface-alt text-center">
                  <th className="border border-border p-2">اسم المستخدم</th>
                  {/** مخفي بناءً على طلب: عمود البريد الإلكتروني */}
                  {/** <th className="border border-border p-2">البريد الإلكتروني</th> */}
                  <th className="border border-border p-2">الرصيد</th>
                  <th className="border border-border p-2">الحالة</th>
                  <th className="border border-border p-2">إجراءات</th>
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
                          title={isActive ? 'نشط' : 'غير نشط'}
                        />
                      </td>
                      <td className="border border-border px-2 py-1">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openTopup(u)}
                            className="bg-success text-text-inverse px-3 py-1 rounded hover:brightness-110"
                            title="إضافة إلى الرصيد"
                          >
                            +
                          </button>
                          <button
                            onClick={() => handleReset2FA(u.id)}
                            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                            title="إعادة تعيين المصادقة الثنائية"
                          >
                            Reset 2FA
                          </button>
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="bg-primary text-primary-contrast px-3 py-1 rounded hover:bg-primary-hover"
                          >
                            تعديل
                          </Link>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="bg-danger text-text-inverse px-3 py-1 rounded hover:brightness-110"
                          >
                            حذف
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
            <div className="text-text-secondary mt-4">لا توجد نتائج مطابقة</div>
          )}
        </>
      )}

      {/* نافذة إضافة رصيد */}
      {topupOpen && topupUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-bg-surface text-text-primary border border-border rounded-lg p-5 w-full max-w-md">
            <h2 className="text-lg font-bold mb-3">إضافة رصيد للمستخدم</h2>

            {/* اسم المستخدم أو الإيميل */}
            <div className="mb-2 text-sm">
              المستخدم:{' '}
              <span className="font-semibold">
                {topupUser.username?.trim() ? topupUser.username : topupUser.email}
              </span>
            </div>

            {/* عملة المستخدم بالرمز والكود */}
            <div className="mb-2 text-sm">
              عملة المستخدم:{' '}
              <span className="font-semibold">
                {currencySymbol(topupUser.currency?.code || undefined)}{' '}
                ({topupUser.currency?.code ?? '-'})
              </span>
            </div>

            {/* الرصيد السابق */}
            <div className="mb-4 text-sm">
              الرصيد السابق هو:{' '}
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
              <label className="block mb-1">المبلغ</label>
              <input
                type="number"
                step="0.0001"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                className="w-full bg-bg-input border border-border px-3 py-2 rounded"
                placeholder={`مثال: 100 ${currencySymbol(topupUser.currency?.code || undefined)}`}
                inputMode="decimal"
              />
            </div>

            <div className="mb-4">
              <label className="block mb-1">وسيلة الدفع<span className="text-danger"> *</span></label>
              <select
                value={selectedMethodId}
                onChange={(e) => setSelectedMethodId(e.target.value)}
                className="w-full bg-bg-input border border-border px-3 py-2 rounded"
              >
                <option value="">اختر وسيلة</option>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block mb-1">ملاحظة (اختياري)</label>
              <textarea
                value={topupNote}
                onChange={(e) => setTopupNote(e.target.value)}
                rows={2}
                className="w-full bg-bg-input border border-border px-3 py-2 rounded resize-none"
                placeholder="مثال: شحن يدوي لأسباب دعم"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={confirmTopup}
                className="px-4 py-2 rounded bg-success text-text-inverse hover:brightness-110"
              >
                إضافة
              </button>
              <button
                onClick={() => {
                  setTopupOpen(false);
                  setTopupUser(null);
                  setTopupAmount('');
                }}
                className="px-4 py-2 rounded bg-bg-surface-alt border border-border hover:opacity-90"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
