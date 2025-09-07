"use client";
import React, { useEffect, useState } from 'react';

interface ExportDetail { id:string; total_usd_at_export:string; usd_to_try_at_export:string; created_at:string; snapshot?: { rate:number; parties:any[]; sums:{ debt_try:number; debt_usd:number; total_usd:number }; exported_at:string } }

async function api<T>(path: string): Promise<T> {
  const token = localStorage.getItem('authToken');
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function ExportDetailPage({ params }: { params: { id: string }}) {
  const { id } = params;
  const [data,setData]=useState<ExportDetail|null>(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<string|null>(null);

  useEffect(()=>{
    (async()=>{
      try { const d = await api<ExportDetail>(`/api/muhammed/exports/${id}`); setData(d); }
      catch(e:any){ setErr('تعذر التحميل'); }
      finally{ setLoading(false); }
    })();
  },[id]);

  if(loading) return <div className="py-10 text-center text-slate-400">جار التحميل...</div>;
  if(err||!data) return <div className="py-10 text-center text-red-400">{err||'غير موجود'}</div>;

  const snap = data.snapshot;
  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">تفاصيل الجرد</h2>
        <a href="/muhammed/exports" className="text-xs text-indigo-300 hover:text-white underline">عودة</a>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="rounded border border-slate-700 bg-slate-800 p-3">المجموع بالدولار وقت الجرد: <span className="font-mono font-medium">{(+data.total_usd_at_export).toFixed(4)}</span></div>
        <div className="rounded border border-slate-700 bg-slate-800 p-3">سعر الصرف: <span className="font-mono">{(+data.usd_to_try_at_export).toFixed(4)}</span></div>
        <div className="rounded border border-slate-700 bg-slate-800 p-3">التاريخ: <span className="font-mono text-slate-300">{new Date(data.created_at).toLocaleString()}</span></div>
      </div>
      {snap ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">الجهات وقت الجرد</h3>
          <div className="overflow-x-auto rounded border border-slate-700 bg-slate-800">
            <table className="min-w-full text-xs rtl:text-right">
              <thead className="bg-slate-700/60 text-slate-200">
                <tr>
                  <th className="p-2">الجهة</th>
                  <th className="p-2">دين TRY</th>
                  <th className="p-2">دين USD</th>
                  <th className="p-2">ملاحظة</th>
                </tr>
              </thead>
              <tbody>
                {snap.parties.map(p => (
                  <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-700/40">
                    <td className="p-2">{p.name}</td>
                    <td className="p-2 font-mono">{(+p.debt_try).toFixed(2)}</td>
                    <td className="p-2 font-mono">{(+p.debt_usd).toFixed(2)}</td>
                    <td className="p-2 text-slate-300 max-w-xs truncate" title={p.note||''}>{p.note||''}</td>
                  </tr>
                ))}
                {!snap.parties.length && <tr><td className="p-4 text-center text-slate-400" colSpan={4}>لا بيانات</td></tr>}
              </tbody>
              <tfoot className="bg-slate-900/60 text-slate-200">
                <tr>
                  <td className="p-2">المجاميع</td>
                  <td className="p-2 font-mono">{snap.sums.debt_try.toFixed(2)}</td>
                  <td className="p-2 font-mono">{snap.sums.debt_usd.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-sm text-slate-400">لا يوجد تفصيل (جرد قديم قبل دعم اللقطات)</div>
      )}
    </div>
  );
}
