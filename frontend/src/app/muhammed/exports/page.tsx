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

  function flash(msg:string,type:'ok'|'err'='ok'){ setToast({msg,type}); setTimeout(()=>setToast(null),2500); }

  const load = useCallback(async()=>{
    setLoading(true);
    try { const q = new URLSearchParams(); if(from) q.append('from',from); if(to) q.append('to',to); const d = await api<ExportRow[]>(`/muhammed/exports${q.size?`?${q.toString()}`:''}`); setRows(d);} catch(e){ flash('فشل التحميل','err'); } finally { setLoading(false); }
  },[from,to]);

  useEffect(()=>{ load(); },[load]);

  return (
    <div className="space-y-4">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow text-sm ${toast.type==='ok'?'bg-green-600 text-white':'bg-red-600 text-white'}`}>{toast.msg}</div>}

      <div className="flex flex-col md:flex-row gap-3 md:items-end">
        <div className="flex flex-col text-sm">
          <label className="text-gray-600 mb-1">من تاريخ</label>
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring" />
        </div>
        <div className="flex flex-col text-sm">
          <label className="text-gray-600 mb-1">إلى تاريخ</label>
            <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="rounded border px-2 py-1 text-sm focus:outline-none focus:ring" />
        </div>
        <button onClick={load} className="h-9 px-4 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm shadow">تصفية</button>
        <button onClick={()=>{ setFrom(''); setTo(''); setTimeout(load,0); }} className="h-9 px-4 rounded border text-sm bg-white hover:bg-gray-50">إعادة ضبط</button>
      </div>

      {loading ? <div className="py-8 text-center text-gray-500">جار التحميل...</div> : (
        <div className="overflow-x-auto rounded border bg-white">
          <table className="min-w-full text-sm rtl:text-right">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="p-2 font-medium">التاريخ</th>
                <th className="p-2 font-medium">المجموع بالدولار</th>
                <th className="p-2 font-medium">سعر الصرف</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=> (
                <tr key={r.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2 font-mono">{(+r.total_usd_at_export).toFixed(4)}</td>
                  <td className="p-2 font-mono">{(+r.usd_to_try_at_export).toFixed(4)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td className="p-4 text-center text-gray-400 text-sm" colSpan={3}>لا سجلات</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
