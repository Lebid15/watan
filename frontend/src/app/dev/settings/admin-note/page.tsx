'use client';
import { useState } from 'react';
import api from '@/utils/api';

// صفحة إرسال ملاحظة تُعرض في كل لوحات /admin (مكان التنبيه الحالي) عبر تخزينها مؤقتًا ثم يمكن لاحقاً دعمها من الباك إند
// ملاحظة: حالياً سنحاكي العملية بتخزين القيمة في localStorage تحت المفتاح adminGlobalAlert
// ويجب أن يقرأها layoutClient لاحقاً (سنعدل هناك) بدل النص الثابت.

export default function DevAdminNotePage() {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback('');
    try {
      setSaving(true);
      const trimmed = note.trim();
      if (!trimmed) { setFeedback('أدخل ملاحظة أولاً'); return; }

      // محاولة استدعاء API مستقبلي (معلق حالياً)
      // await api.post('/admin/global-alert', { message: trimmed });

      try { localStorage.setItem('adminGlobalAlert', trimmed); } catch {}
      setFeedback('تم حفظ الملاحظة (محلياً حالياً).');
    } catch (err: any) {
      setFeedback(err?.response?.data?.message || 'فشل حفظ الملاحظة');
    } finally {
      setSaving(false);
    }
  };

  const clearNote = () => {
    try { localStorage.removeItem('adminGlobalAlert'); } catch {}
    setNote('');
    setFeedback('تم حذف الملاحظة.');
  };

  return (
    <div className="p-6 max-w-xl" dir="rtl">
      <h1 className="text-2xl font-bold mb-4">إرسال ملاحظة</h1>
      <p className="text-sm text-text-secondary mb-4">ستظهر هذه الملاحظة أعلى صفحات /admin لكل الساب دومينز النشطة (استبدالاً للتنبيه الثابت). حالياً يتم التخزين محلياً فقط.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block mb-1 text-sm">نص الملاحظة</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="input w-full min-h-[120px]"
            placeholder="مثال: سيتم إجراء صيانة مجدولة الساعة 3 صباحاً..."
          />
        </div>
        {feedback && <div className="text-xs text-text-secondary">{feedback}</div>}
        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn btn-primary disabled:opacity-60">{saving ? 'يحفظ...' : 'حفظ'}</button>
          <button type="button" onClick={clearNote} className="btn btn-secondary">مسح</button>
        </div>
      </form>
    </div>
  );
}
