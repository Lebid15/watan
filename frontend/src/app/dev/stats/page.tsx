'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api, { API_BASE_URL } from '@/utils/api';

type SupervisorRow = {
  id: string;
  name: string;
  email: string;
  usersCount: number;
  approvedOrdersCount: number;
  isActive?: boolean; // قد لا يكون موجودًا لو لم تُحدّث الباك بعد
};

export default function DevStatsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<SupervisorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null); // لمنع نقرات مكررة لكل صف

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await api.get(`${API_BASE_URL}/admin/stats/supervisors`);
      setRows(res.data as SupervisorRow[]);
    } catch {
      setErr('فشل في جلب بيانات المشرفين');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

    async function toggleActive(id: string, current?: boolean) {
    try {
        setBusyId(id);
        const next = !(current ?? true);
        // الصحيح: PATCH /users/:id/active
        await api.patch(`${API_BASE_URL}/users/${id}/active`, { isActive: next });
        setRows((old) => old.map((r) => (r.id === id ? { ...r, isActive: next } : r)));
    } catch {
        alert('لم يتم تبديل الحالة');
    } finally {
        setBusyId(null);
    }
    }

    async function changePassword(id: string, email: string) {
    const pwd = prompt(`أدخل كلمة مرور جديدة للمشرف (${email}):`);
    if (!pwd) return;
    try {
        setBusyId(id);
        // الصحيح: PATCH /users/:id/password
        await api.patch(`${API_BASE_URL}/users/${id}/password`, { password: pwd });
        alert('تم تغيير كلمة المرور ✅');
    } catch {
        alert('فشل تغيير كلمة المرور ❌');
    } finally {
        setBusyId(null);
    }
    }


  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">إحصائيات المشرفين</h1>
        <p>⏳ جاري التحميل...</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">إحصائيات المشرفين</h1>
        <p className="text-red-600">{err}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">إحصائيات المشرفين</h1>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border rounded shadow text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 border text-right">المشرف</th>
              <th className="px-3 py-2 border text-right">الإيميل</th>
              <th className="px-3 py-2 border text-center">عدد المستخدمين</th>
              <th className="px-3 py-2 border text-center">الطلبات المقبولة</th>
              <th className="px-3 py-2 border text-center">الحالة</th>
              <th className="px-3 py-2 border text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const active = r.isActive ?? true; // افتراضيًا فعّال لو الحقل غير موجود بعد
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border">{r.name || '-'}</td>
                  <td className="px-3 py-2 border">{r.email}</td>
                  <td className="px-3 py-2 border text-center">{r.usersCount}</td>
                  <td className="px-3 py-2 border text-center">{r.approvedOrdersCount}</td>
                  <td className="px-3 py-2 border text-center">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => toggleActive(r.id, active)}
                      title={active ? 'فعّال (انقر للتعطيل)' : 'مُعطّل (انقر للتفعيل)'}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full border ${
                        active ? 'bg-green-500 border-green-600' : 'bg-red-500 border-red-600'
                      } ${busyId === r.id ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                    />
                  </td>
                  <td className="px-3 py-2 border">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        disabled={busyId === r.id}
                        onClick={() => changePassword(r.id, r.email)}
                        className="px-3 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60"
                      >
                        تغيير كلمة السر
                      </button>
                      <button
                        onClick={() => router.push(`/dev/stats/${r.id}`)}
                        className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        تفاصيل
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center p-6 text-gray-500">
                  لا يوجد مشرفون حتى الآن.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
