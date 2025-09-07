"use client";
import React, { useEffect, useState, useCallback, useRef } from 'react';

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
  const [deletingId,setDeletingId] = useState<string|null>(null);
  const nameRefs = useRef<Record<string, HTMLInputElement|null>>({});

  const load = useCallback(async ()=>{
    setLoading(true);
    try { const d = await api<SheetData>('/api/muhammed/sheet'); setData(d); } catch(e:any){ setToast({msg:'فشل التحميل', type:'err'});} finally { setLoading(false);}  
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
  const updated = await api<any>(`/api/muhammed/party/${id}`, { method:'PATCH', body: JSON.stringify(body) });
  setData(d => d ? { ...d, parties: d.parties.map(p=> p.id===id ? { ...p, name: updated.name ?? p.name, debt_try: +updated.debt_try, debt_usd: +updated.debt_usd, note: updated.note } : p ) } : d);
      flash('تم الحفظ');
    } catch(e){ flash('خطأ', 'err'); }
    finally { setSavingField(null); }
  }

  async function saveRate(rate: number){
    setSavingField('rate');
  try { await api('/api/muhammed/rate',{ method:'PATCH', body: JSON.stringify({ rate })}); await load(); flash('تم تحديث السعر'); } catch(e){ flash('خطأ', 'err'); } finally { setSavingField(null);}  
  }

  async function addParty(){
    if (!newName.trim()) return;
    setAdding(true);
  try { await api('/api/muhammed/party',{ method:'POST', body: JSON.stringify({ name: newName.trim() })}); setShowDialog(false); setNewName(''); await load(); flash('أضيفت جهة'); } catch(e){ flash('خطأ','err'); } finally { setAdding(false);}  
  }

  async function createExport(){
  try { await api('/api/muhammed/export',{ method:'POST'}); await load(); flash('تم التصدير'); } catch(e){ flash('خطأ','err'); }
  }

  async function deleteParty(id: string){
    if (!confirm('حذف هذه الجهة؟ لا يمكن التراجع')) return;
    setDeletingId(id);
    try {
      await api(`/api/muhammed/party/${id}`, { method: 'DELETE' });
      setData(d => d ? { ...d, parties: d.parties.filter(p=>p.id!==id) } : d);
      flash('تم الحذف');
    } catch(e){
      flash('فشل الحذف','err');
    } finally { setDeletingId(null); }
  }

  if (loading) return <div className="py-10 text-center text-gray-500">جار التحميل...</div>;
  // إذا فشل التحميل تماماً (خطأ حقيقي) ولم تصل أي بيانات
  if (!data && !loading) {
    return <div className="space-y-4">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow text-sm ${toast.type==='ok'?'bg-green-600 text-white':'bg-red-600 text-white'}`}>{toast.msg}</div>}
      <div className="text-center text-red-500">تعذر تحميل البيانات</div>
      <div className="text-center"><button onClick={load} className="rounded bg-blue-600 text-white px-4 py-2 text-sm">إعادة المحاولة</button></div>
    </div>;
  }

  if (!data) return null; // safeguards (should have returned earlier if null)

  return (
    <div className="space-y-3 text-[12px]">
      {toast && <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded shadow text-sm ${toast.type==='ok'?'bg-green-600 text-white':'bg-red-600 text-white'}`}>{toast.msg}</div>}

      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-slate-200">كل 1 دولار =</label>
          <input defaultValue={data?.rate ?? 0} onBlur={e=>{ const v= parseFloat(e.target.value)||0; if(v>0) saveRate(v); }} className="w-24 rounded border border-slate-600 bg-white text-black px-2 py-[3px] text-[11px] focus:outline-none focus:ring focus:ring-indigo-500" type="number" step="0.0001"/>
          {savingField==='rate' && <span className="text-[10px] text-slate-400">حفظ...</span>}
        </div>
        <button onClick={()=>setShowDialog(true)} className="rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] px-3 py-[6px] shadow">إضافة جهة جديدة</button>
      </div>

  <div className="overflow-x-auto rounded border border-slate-700 bg-slate-800 shadow-sm text-black">
        <table className="min-w-full text-[11px] rtl:text-right">
      <thead className="bg-slate-700/60 text-slate-200">
            <tr>
              <th className="p-2 font-medium">الجهة</th>
              <th className="p-2 font-medium">دين (TRY)</th>
              <th className="p-2 font-medium">دين (USD)</th>
              <th className="p-2 font-medium">ملاحظة</th>
              <th className="p-2 font-medium text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {data.parties.length===0 && (
              <tr>
                <td colSpan={5} className="p-4 text-center text-[11px] text-gray-500">لا توجد جهات بعد</td>
              </tr>
            )}
            {data.parties.map(p=>{
              const posTry = p.debt_try>0; const posUsd = p.debt_usd>0;
              return (
                <tr key={p.id} className="border-t border-slate-700 hover:bg-slate-700/40 transition-colors">
                  <td className="p-2 align-top">
                    <EditableText innerRef={el=>{ nameRefs.current[p.id]=el; }} value={p.name} onSave={val=> saveParty(p.id,{ name: val })} />
                  </td>
                  <td className={`p-2 align-top font-mono ${posTry?'text-red-600':''}`}>
                    <EditableNumber value={p.debt_try} onSave={val=> saveParty(p.id,{ debt_try: val })} />
                  </td>
                  <td className={`p-2 align-top font-mono ${posUsd?'text-red-600':''}`}>
                    <EditableNumber value={p.debt_usd} onSave={val=> saveParty(p.id,{ debt_usd: val })} />
                  </td>
                  <td className="p-2 align-top w-60">
                    <EditableTextarea value={p.note||''} onSave={val=> saveParty(p.id,{ note: val })} />
                  </td>
                  <td className="p-2 text-[10px] text-gray-500 whitespace-nowrap align-top">
                    <div className="flex gap-2 items-center justify-center">
                      <button onClick={()=> nameRefs.current[p.id]?.focus()} className="px-2 py-[3px] rounded border border-slate-600 bg-slate-900 hover:bg-slate-700 text-[10px] text-slate-200">تحرير</button>
                      <button disabled={deletingId===p.id} onClick={()=>deleteParty(p.id)} className="px-2 py-[3px] rounded bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-[10px]">حذف</button>
                    </div>
                    <div className="h-4 mt-1 text-center">
                      {savingField?.startsWith(p.id)&& <span className="text-amber-600">حفظ...</span>}
                      {deletingId===p.id && <span className="text-red-600">جاري...</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-slate-900/60 text-[11px] font-medium text-slate-200">
            <tr>
              <td className="p-2">المجاميع</td>
              <td className="p-2 font-mono">{data.sums.debt_try.toFixed(2)}</td>
              <td className="p-2 font-mono">{data.sums.debt_usd.toFixed(2)}</td>
              <td className="p-2" colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

  <div className="rounded border border-slate-700 p-3 bg-slate-800 flex flex-col gap-2 text-[11px] shadow-sm">
  <div>المجموع الكلي بالدولار: <span className="font-mono font-semibold text-slate-100">{data.sums.total_usd.toFixed(4)}</span></div>
  <div>آخر جرد: <span className="font-mono text-slate-300">{data.lastExport ? (+data.lastExport.total_usd_at_export).toFixed(4) : '—'}</span></div>
  <div>الربح: <span className={`font-mono ${(data.profit||0) >=0 ? 'text-green-400':'text-red-400'}`}>{data.profit!=null? data.profit.toFixed(4):'—'}</span></div>
  <div><button onClick={createExport} className="rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-3 py-[6px]">تصدير</button></div>
      </div>

      {showDialog && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40">
          <div className="bg-slate-800 border border-slate-700 rounded shadow-lg w-full max-w-sm p-3 space-y-3 text-slate-100 text-[11px]">
            <h2 className="font-semibold text-slate-100 text-[12px]">إضافة جهة جديدة</h2>
            <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} placeholder="اسم الجهة" className="w-full rounded border border-slate-600 bg-white text-black placeholder-slate-500 px-2 py-[6px] text-[11px] focus:outline-none focus:ring focus:ring-indigo-500" />
            <div className="flex justify-end gap-2 text-[11px]">
              <button onClick={()=>setShowDialog(false)} className="px-3 py-[5px] rounded border border-slate-600 bg-slate-900 hover:bg-slate-700">إلغاء</button>
              <button disabled={adding} onClick={addParty} className="px-4 py-[5px] rounded bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditableText({ value, onSave, innerRef }:{ value:string; onSave:(v:string)=>void; innerRef?:(el:HTMLInputElement|null)=>void }){
  const [val,setVal]=useState(value); const [focus,setFocus]=useState(false);
  return <input ref={innerRef} value={val} onFocus={()=>setFocus(true)} onChange={e=>setVal(e.target.value)} onBlur={()=>{ setFocus(false); if(val!==value) onSave(val.trim()||value); }} className={`w-full rounded border px-2 py-[4px] text-[11px] text-black focus:outline-none focus:ring focus:ring-blue-500 ${focus?'bg-white':'bg-white'}`} />;
}
function EditableNumber({ value, onSave }:{ value:number; onSave:(v:number)=>void }){
  const [val,setVal]=useState(String(value)); const [focus,setFocus]=useState(false);
  return <input inputMode="decimal" value={val} onFocus={()=>setFocus(true)} onChange={e=>setVal(e.target.value)} onBlur={()=>{ setFocus(false); const num=parseFloat(val); if(!isNaN(num) && num!==value) onSave(num); else setVal(String(value)); }} className={`w-28 rounded border px-2 py-[4px] text-[11px] text-black focus:outline-none focus:ring focus:ring-blue-500 text-end font-mono ${focus?'bg-white':'bg-white'}`} />;
}
function EditableTextarea({ value, onSave }:{ value:string; onSave:(v:string)=>void }){
  const [val,setVal]=useState(value); const [focus,setFocus]=useState(false);
  return <textarea value={val} onFocus={()=>setFocus(true)} onChange={e=>setVal(e.target.value)} onBlur={()=>{ setFocus(false); if(val!==value) onSave(val); }} rows={2} className={`w-full resize-none rounded border px-2 py-[4px] text-[11px] text-black focus:outline-none focus:ring focus:ring-blue-500 ${focus?'bg-white':'bg-white'}`} />;
}
