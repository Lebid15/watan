"use client";
import React, { useEffect, useState, useCallback } from 'react';

interface PartyRow { id: string; name: string; debt_try: number; debt_usd: number; note?: string | null; updated_at: string; }
interface SheetData { rate: number; parties: PartyRow[]; sums: { debt_try: number; debt_usd: number; total_usd: number }; lastExport?: any; profit?: number | null; }

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('authToken');
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...(opts.headers||{}) } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function MuhSheetPage() {
  const [data, setData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [toast, setToast] = useState<{msg:string,type:'ok'|'err'}|null>(null);

  const load = useCallback(async ()=>{
    setLoading(true);
    try { const d = await api<SheetData>('/muhammed/sheet'); setData(d); } catch(e:any){ setToast({msg:'فشل التحميل', type:'err'});} finally { setLoading(false);}  
  },[]);

  useEffect(()=>{ load(); },[load]);

  function flash(msg:string,type:'ok'|'err'='ok'){ setToast({msg,type}); setTimeout(()=>setToast(null),2500); }

  async function saveParty(id:string, patch:Partial<PartyRow>) {
    setSavingField(id+Object.keys(patch).join(','));
    try {
      const body: any = {};
      if (patch.name!==undefined) body.name = patch.name;
      if (patch.debt_try!==undefined) body.debt_try = patch.debt_try;
      if (patch.debt_usd!==undefined) body.debt_usd = patch.debt_usd;
      if (patch.note!==undefined) body.note = patch.note;
  const updated = await api<any>(`/muhammed/party/${id}`, { method:'PATCH', body: JSON.stringify(body) });
  setData(d => d ? { ...d, parties: d.parties.map(p=> p.id===id ? { ...p, name: updated.name ?? p.name, debt_try: +updated.debt_try, debt_usd: +updated.debt_usd, note: updated.note } : p ) } : d);
      flash('تم الحفظ');
    } catch(e){ flash('خطأ', 'err'); }
    finally { setSavingField(null); }
  }

  async function saveRate(rate: number){
    setSavingField('rate');
    try { await api('/muhammed/rate',{ method:'PATCH', body: JSON.stringify({ rate })}); await load(); flash('تم تحديث السعر'); } catch(e){ flash('خطأ', 'err'); } finally { setSavingField(null);}  
  }

  async function addParty(){
    if (!newName.trim()) return;
    setAdding(true);
    try { await api('/muhammed/party',{ method:'POST', body: JSON.stringify({ name: newName.trim() })}); setShowDialog(false); setNewName(''); await load(); flash('أضيفت جهة'); } catch(e){ flash('خطأ','err'); } finally { setAdding(false);}  
  }

  async function createExport(){
    try { await api('/muhammed/export',{ method:'POST'}); await load(); flash('تم التصدير'); } catch(e){ flash('خطأ','err'); }
  }

  if (loading) return <div className="py-10 text-center text-gray-500">جار التحميل...</div>;
  if (!data) return <div className="text-center text-red-500">لا بيانات</div>;

  return (
    <div className="space-y-4">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow text-sm ${toast.type==='ok'?'bg-green-600 text-white':'bg-red-600 text-white'}`}>{toast.msg}</div>}

      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700">كل 1 دولار =</label>
          <input defaultValue={data.rate} onBlur={e=>{ const v= parseFloat(e.target.value)||0; if(v>0) saveRate(v); }} className="w-28 rounded border px-2 py-1 text-sm focus:outline-none focus:ring" type="number" step="0.0001"/>
          {savingField==='rate' && <span className="text-xs text-gray-500">حفظ...</span>}
        </div>
        <button onClick={()=>setShowDialog(true)} className="rounded bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 shadow">إضافة جهة جديدة</button>
      </div>

      <div className="overflow-x-auto rounded border">
        <table className="min-w-full text-sm rtl:text-right">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="p-2 font-medium">الجهة</th>
              <th className="p-2 font-medium">دين (TRY)</th>
              <th className="p-2 font-medium">دين (USD)</th>
              <th className="p-2 font-medium">ملاحظة</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {data.parties.map(p=>{
              const posTry = p.debt_try>0; const posUsd = p.debt_usd>0;
              return (
                <tr key={p.id} className="border-t hover:bg-gray-50">
                  <td className="p-2 align-top">
                    <EditableText value={p.name} onSave={val=> saveParty(p.id,{ name: val })} />
                  </td>
                  <td className={`p-2 align-top font-mono ${posTry?'text-red-600':''}`}>
                    <EditableNumber value={p.debt_try} onSave={val=> saveParty(p.id,{ debt_try: val })} />
                  </td>
                  <td className={`p-2 align-top font-mono ${posUsd?'text-red-600':''}`}>
                    <EditableNumber value={p.debt_usd} onSave={val=> saveParty(p.id,{ debt_usd: val })} />
                  </td>
                  <td className="p-2 align-top w-64">
                    <EditableTextarea value={p.note||''} onSave={val=> saveParty(p.id,{ note: val })} />
                  </td>
                  <td className="p-2 text-xs text-gray-400 whitespace-nowrap">{savingField?.startsWith(p.id)?'حفظ...':''}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-100 text-sm font-medium">
            <tr>
              <td className="p-2">المجاميع</td>
              <td className="p-2 font-mono">{data.sums.debt_try.toFixed(2)}</td>
              <td className="p-2 font-mono">{data.sums.debt_usd.toFixed(2)}</td>
              <td className="p-2" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="rounded border p-4 bg-white flex flex-col gap-2 text-sm">
        <div>المجموع الكلي بالدولار: <span className="font-mono font-semibold">{data.sums.total_usd.toFixed(4)}</span> <button onClick={createExport} className="ml-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1">تصدير</button></div>
        <div>آخر تصدير: <span className="font-mono">{data.lastExport ? (+data.lastExport.total_usd_at_export).toFixed(4) : '—'}</span></div>
        <div>الربح: <span className={`font-mono ${ (data.profit||0) >=0 ? 'text-green-600':'text-red-600'}`}>{data.profit!=null? data.profit.toFixed(4):'—'}</span></div>
      </div>

      {showDialog && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
          <div className="bg-white rounded shadow w-full max-w-sm p-4 space-y-4">
            <h2 className="font-semibold text-gray-800 text-sm">إضافة جهة جديدة</h2>
            <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="اسم الجهة" className="w-full rounded border px-3 py-2 text-sm focus:outline-none focus:ring" />
            <div className="flex justify-end gap-2 text-sm">
              <button onClick={()=>setShowDialog(false)} className="px-3 py-1 rounded border bg-gray-50 hover:bg-gray-100">إلغاء</button>
              <button disabled={adding} onClick={addParty} className="px-4 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditableText({ value, onSave }:{ value:string; onSave:(v:string)=>void }){
  const [val,setVal]=useState(value); const [focus,setFocus]=useState(false);
  return <input value={val} onFocus={()=>setFocus(true)} onChange={e=>setVal(e.target.value)} onBlur={()=>{ setFocus(false); if(val!==value) onSave(val.trim()||value); }} className={`w-full rounded border px-2 py-1 text-sm focus:outline-none focus:ring ${focus?'bg-white':'bg-gray-50'}`} />;
}
function EditableNumber({ value, onSave }:{ value:number; onSave:(v:number)=>void }){
  const [val,setVal]=useState(String(value)); const [focus,setFocus]=useState(false);
  return <input inputMode="decimal" value={val} onFocus={()=>setFocus(true)} onChange={e=>setVal(e.target.value)} onBlur={()=>{ setFocus(false); const num=parseFloat(val); if(!isNaN(num) && num!==value) onSave(num); else setVal(String(value)); }} className={`w-32 rounded border px-2 py-1 text-sm focus:outline-none focus:ring text-end font-mono ${focus?'bg-white':'bg-gray-50'}`} />;
}
function EditableTextarea({ value, onSave }:{ value:string; onSave:(v:string)=>void }){
  const [val,setVal]=useState(value); const [focus,setFocus]=useState(false);
  return <textarea value={val} onFocus={()=>setFocus(true)} onChange={e=>setVal(e.target.value)} onBlur={()=>{ setFocus(false); if(val!==value) onSave(val); }} rows={2} className={`w-full resize-none rounded border px-2 py-1 text-xs focus:outline-none focus:ring ${focus?'bg-white':'bg-gray-50'}`} />;
}
