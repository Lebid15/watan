"use client";
import React, { useEffect, useState, useCallback } from 'react';

interface ExportRow { id:string; total_usd_at_export:string; usd_to_try_at_export:string; created_at:string }

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('authToken');
  const res = await fetch(path + (path.includes('?')?'':'') , { ...opts, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(opts.headers||{}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function MuhExportsPage(){
  const [rows,setRows]=useState<ExportRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [toast,setToast]=useState<{msg:string,type:'ok'|'err'}|null>(null);
  const [deleting,setDeleting]=useState<string|null>(null);

  function flash(msg:string,type:'ok'|'err'='ok'){ setToast({msg,type}); setTimeout(()=>setToast(null),2500); }

  const load = useCallback(async()=>{
    setLoading(true);
  try { const q = new URLSearchParams(); if(from) q.append('from',from); if(to) q.append('to',to); const d = await api<ExportRow[]>(`/api/muhammed/exports${q.size?`?${q.toString()}`:''}`); setRows(d);} catch(e){ flash('فشل التحميل','err'); } finally { setLoading(false); }
  },[from,to]);

  useEffect(()=>{ load(); },[load]);

  return (
  <div className="space-y-3 text-slate-100 text-[12px]">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow text-sm ${toast.type==='ok'?'bg-green-600 text-white':'bg-red-600 text-white'}`}>{toast.msg}</div>}

      <div className="flex flex-col md:flex-row gap-2 md:items-end">
        <div className="flex flex-col text-[11px]">
          <label className="text-slate-300 mb-1">من تاريخ</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="rounded border border-slate-600 bg-slate-900 text-slate-100 px-2 py-[4px] text-[11px] focus:outline-none focus:ring focus:ring-indigo-500" />
        </div>
        <div className="flex flex-col text-[11px]">
          <label className="text-slate-300 mb-1">إلى تاريخ</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="rounded border border-slate-600 bg-slate-900 text-slate-100 px-2 py-[4px] text-[11px] focus:outline-none focus:ring focus:ring-indigo-500" />
        </div>
        <button onClick={load} className="h-8 px-3 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] shadow">تصفية</button>
        <button onClick={()=>{ setFrom(''); setTo(''); setTimeout(load,0); }} className="h-8 px-3 rounded border border-slate-600 text-[11px] bg-slate-900 hover:bg-slate-700 text-slate-200">إعادة ضبط</button>
      </div>

      {loading ? <div className="py-8 text-center text-slate-400">جار التحميل...</div> : (
        <div className="overflow-x-auto rounded border border-slate-700 bg-slate-800 shadow-sm">
          <table className="min-w-full text-[11px] rtl:text-right">
            <thead className="bg-slate-700/60 text-slate-200">
              <tr>
                <th className="p-2 font-medium">التاريخ</th>
                <th className="p-2 font-medium">المجموع بالدولار</th>
                <th className="p-2 font-medium">سعر الصرف</th>
                <th className="p-2 font-medium">تفاصيل</th>
                <th className="p-2 font-medium text-center">حذف</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=> (
                <tr key={r.id} className="border-t border-slate-700 hover:bg-slate-700/40">
                  <td className="p-2 whitespace-nowrap text-xs text-slate-300">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2 font-mono">{(+r.total_usd_at_export).toFixed(4)}</td>
                  <td className="p-2 font-mono">{(+r.usd_to_try_at_export).toFixed(4)}</td>
                  <td className="p-2"><a href={`/muhammed/exports/${r.id}`} className="text-indigo-300 hover:text-white text-xs underline">عرض</a></td>
                  <td className="p-2 text-center">
                    <button disabled={deleting===r.id} onClick={async()=>{ if(!confirm('حذف الجرد؟')) return; setDeleting(r.id); try { await api(`/api/muhammed/exports/${r.id}`, { method:'DELETE'}); setRows(rs=>rs.filter(x=>x.id!==r.id)); flash('تم الحذف'); } catch(e){ flash('فشل','err'); } finally { setDeleting(null);} }} className="text-xs rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-2 py-1">حذف</button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td className="p-4 text-center text-slate-400 text-sm" colSpan={5}>لا سجلات</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
