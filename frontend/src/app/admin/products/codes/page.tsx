'use client';

import React, { useEffect, useMemo, useState } from 'react';
import api from '@/utils/api';
import Link from 'next/link';

type CodeGroup = {
  id: string;
  name: string;
  publicCode: string;
  note?: string | null;
  providerType: 'internal_codes' | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function CodeGroupsPage() {
  const notify = (msg: string) => {
    try { console.log(msg); } catch {}
    if (typeof window !== 'undefined') alert(msg);
  };

  const [groups, setGroups] = useState<CodeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', publicCode: '', note: '' });
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    let data = groups;
    if (filter !== 'all') data = data.filter((g) => (filter === 'active' ? g.isActive : !g.isActive));
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      data = data.filter(
        (g) =>
          g.name.toLowerCase().includes(s) ||
          g.publicCode.toLowerCase().includes(s) ||
          (g.note || '').toLowerCase().includes(s),
      );
    }
    return data;
  }, [groups, filter, q]);

  const loadGroups = async () => {
    setLoading(true);
    try {
      const res = await api.get<CodeGroup[]>('/admin/codes/groups');
      setGroups(res.data ?? []);
    } catch (e: any) {
      notify(`فشل تحميل المجموعات: ${e?.response?.data?.message || e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.publicCode.trim()) {
      notify('الاسم و الكود العام مطلوبان');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        publicCode: form.publicCode.trim().toUpperCase(),
        note: form.note?.trim() || undefined,
      };
      await api.post('/admin/codes/groups', payload);
      notify('تم إنشاء المجموعة بنجاح');
      setForm({ name: '', publicCode: '', note: '' });
      await loadGroups();
      (document.getElementById('create-dialog') as HTMLDialogElement | null)?.close();
    } catch (e: any) {
      notify(`فشل الإنشاء: ${e?.response?.data?.message || e.message}`);
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (id: string) => {
    try {
      await api.patch(`/admin/codes/groups/${id}/toggle`);
      notify('تم تحديث الحالة');
      await loadGroups();
    } catch (e: any) {
      notify(`فشل التحديث: ${e?.response?.data?.message || e.message}`);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl md:text-2xl font-semibold">مجموعات الأكواد</h1>
        <button
          className="btn btn-primary"
          onClick={() => (document.getElementById('create-dialog') as HTMLDialogElement)?.showModal()}
        >
          + إضافة مجموعة
        </button>
      </div>

      {/* شريط أدوات */}
      <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between mb-4">
        <div className="flex gap-2">
          <button onClick={() => setFilter('all')} className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}>
            الكل
          </button>
          <button onClick={() => setFilter('active')} className={`btn ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`}>
            المفعّلة
          </button>
          <button onClick={() => setFilter('inactive')} className={`btn ${filter === 'inactive' ? 'btn-primary' : 'btn-secondary'}`}>
            المعطّلة
          </button>
        </div>
        <div className="flex items-center gap-2">
          <input
            placeholder="بحث بالاسم / الكود / الملاحظة"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="input w-full md:w-80"
          />
          <button onClick={loadGroups} className="btn btn-secondary">
            تحديث
          </button>
        </div>
      </div>

      {/* الجدول */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr className="text-left">
              <th>#</th>
              <th>الاسم</th>
              <th>الكود العام</th>
              <th>الملاحظة</th>
              <th>الحالة</th>
              <th>تاريخ الإنشاء</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-3 py-3">جاري التحميل…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-3">لا توجد مجموعات.</td></tr>
            ) : (
              filtered.map((g, idx) => (
                <tr key={g.id}>
                  <td>{idx + 1}</td>
                  <td className="font-medium">{g.name}</td>
                  <td><code className="px-2 py-1 rounded bg-[rgba(var(--color-primary)/.15)]">{g.publicCode}</code></td>
                  <td>{g.note || '-'}</td>
                  <td>
                    <button
                      onClick={() => toggleActive(g.id)}
                      className={`btn ${g.isActive ? 'btn-primary' : 'btn-secondary'}`}
                      title={g.isActive ? 'إيقاف' : 'تفعيل'}
                    >
                      {g.isActive ? 'مفعّل' : 'معطّل'}
                    </button>
                  </td>
                  <td>{new Date(g.createdAt).toLocaleString()}</td>
                  <td className="flex gap-2">
                    <Link href={`/admin/products/codes/${g.id}`} className="btn btn-secondary">الأكواد</Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Dialog إضافة مجموعة — أعرض + ألوان الثيم */}
      <dialog id="create-dialog" className="modal">
        <form
          onSubmit={onCreate}
          className={`
            modal-box card w-[95vw] max-w-2xl
            bg-[rgb(var(--color-bg-surface))]
            text-[rgb(var(--color-text-primary))]
            border border-[rgb(var(--color-border))]
            shadow
          `}
        >
          <h3 className="text-lg font-bold mb-4 text-[rgb(var(--color-text-primary))]">
            إضافة مجموعة أكواد
          </h3>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm mb-1 text-[rgb(var(--color-text-secondary))]">
                اسم المجموعة
              </label>
              <input
                className="input w-full"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="مثال: Google Play 25 TL"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1 text-[rgb(var(--color-text-secondary))]">
                الكود العام (publicCode)
              </label>
              <input
                className="input w-full"
                value={form.publicCode}
                onChange={(e) => setForm((f) => ({ ...f, publicCode: e.target.value }))}
                placeholder="مثال: GPLAY-25TRY"
                required
              />
              <p className="text-xs text-[rgb(var(--color-text-secondary))] mt-1">
                أحرف كبيرة/أرقام/.-_ من 3 إلى 32 حرفًا — مثال: <b>ITUNES-50USD</b>
              </p>
            </div>

            <div>
              <label className="block text-sm mb-1 text-[rgb(var(--color-text-secondary))]">
                ملاحظة (اختياري)
              </label>
              <textarea
                className="input w-full"
                rows={3}
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="مثال: أكواد تركية 25 ليرة"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                (document.getElementById('create-dialog') as HTMLDialogElement)?.close()
              }
              className="btn btn-secondary"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={creating}
              className="btn btn-primary disabled:opacity-60"
            >
              {creating ? 'جارٍ الإضافة…' : 'إضافة'}
            </button>
          </div>
        </form>
      </dialog>

      {/* تنسيق الـ dialog */}
      <style jsx global>{`
        .modal[open] {
          display: flex;
          align-items: center;
          justify-content: center;
          position: fixed;
          inset: 0;
          /* Fallback لمتصفحات قديمة */
          background: rgba(0, 0, 0, 0.35);
          /* ✅ خلفية تتبع الثيم (الصيغة الصحيحة) */
          background-color: rgb(var(--color-bg-base) / 0.55);
          z-index: 50;
          padding: 10px;
        }
        .modal-box {
          max-height: 90vh;
          overflow-y: auto;
        }
      `}</style>

    </div>
  );
}
