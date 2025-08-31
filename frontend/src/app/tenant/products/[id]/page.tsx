"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';
import Link from 'next/link';
import { formatMoney3 } from '@/utils/format';
import { useToast } from '@/context/ToastContext';

interface PriceGroupPrice { priceGroupId:string; priceGroupName:string; sellPriceUsd?:number|null; }

export default function TenantProductDetails(){
  const params = useParams();
  const id = params?.id as string;
  const [p,setP]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<any>(null);
  const [groupPrices,setGroupPrices]=useState<PriceGroupPrice[]>([]);
  const [originalPrices,setOriginalPrices]=useState<Record<string, number|null>>({});
  const [savingId,setSavingId]=useState<string|null>(null);
  const { show } = useToast();

  useEffect(()=>{ if(!id) return; (async()=>{ try{
      const [prodRes, groupsRes] = await Promise.all([
        api.get(API_ROUTES.products.byId(id)),
        // Attempt product-specific price groups endpoint; fallback later
        api.get(`/products/${id}/price-groups`).catch(async (_e:any)=>{
          // Fallback generic list (TODO: replace when backend endpoint ready)
          const generic = await api.get(API_ROUTES.priceGroups.base);
          const genRaw = (generic as any)?.data;
          const genArr = Array.isArray(genRaw) ? genRaw : Array.isArray(genRaw?.items) ? genRaw.items : [];
          return { data: genArr.map((g:any)=>({ priceGroupId:g.id, priceGroupName:g.name, sellPriceUsd:null })) };
        })
      ]);
      setP(prodRes.data);
      const rawGroups = (groupsRes as any)?.data;
      const groupsArray = Array.isArray(rawGroups) ? rawGroups : Array.isArray(rawGroups?.items) ? rawGroups.items : [];
  const rows: PriceGroupPrice[] = groupsArray.map((g:any)=>({
          priceGroupId: g.priceGroupId || g.id,
          priceGroupName: g.priceGroupName || g.name,
          sellPriceUsd: g.sellPriceUsd ?? g.priceUsd ?? null,
        }));
      setGroupPrices(rows);
  // snapshot originals for dirty tracking
  const snap: Record<string, number|null> = {};
  rows.forEach((r: PriceGroupPrice)=>{ snap[r.priceGroupId] = r.sellPriceUsd ?? null; });
  setOriginalPrices(snap);
    }catch(e:any){setErr(e);}finally{setLoading(false);} })(); },[id]);

  const updatePrice = async (pgId:string, newValue:string) => {
    const num = Number(newValue);
    setGroupPrices(g=>g.map(r=>r.priceGroupId===pgId?{...r, sellPriceUsd:isNaN(num)?0:num}:r));
  };
  const savePrice = async (pgId:string) => {
    const row = groupPrices.find(r=>r.priceGroupId===pgId);
    if(!row) return;
    setSavingId(pgId);
    try {
      // Preferred endpoint (TODO: implement backend): /products/{id}/price-groups/{priceGroupId}
      await api.post(`/products/${id}/price-groups/${pgId}`, { sellPriceUsd: row.sellPriceUsd });
      setOriginalPrices(o=>({ ...o, [pgId]: row.sellPriceUsd ?? null }));
      show('تم حفظ السعر');
    } catch (e) {
      // TODO remove when real endpoint exists
      // eslint-disable-next-line no-console
      console.warn('[stub] savePrice failed or endpoint missing', e);
      show('فشل حفظ السعر');
    } finally { setSavingId(null);} };
  if(loading) return <div>Loading...</div>;
  if(err) return <div className="text-danger">Error loading product.</div>;
  if(!p) return <div>Not found.</div>;
  return <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">{p.name}</h1>
      <Link href={`/tenant/products/${id}/packages`} className="btn btn-sm">Packages</Link>
    </div>
    <div className="grid md:grid-cols-3 gap-3 text-sm">
      <Info label="Base" value={formatMoney3(p.basePriceUsd||0)} />
      <Info label="Capital" value={formatMoney3(p.capitalPriceUsd||0)} />
    </div>
    <div className="space-y-2">
      <h2 className="font-semibold">Price Groups</h2>
      <table className="w-full text-sm border border-border">
        <thead className="bg-bg-surface-alt">
          <tr>
            <th className="p-2 text-right">Group</th>
            <th className="p-2 text-right">Sell (USD)</th>
            <th className="p-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {groupPrices.map(g=> {
            const original = originalPrices[g.priceGroupId];
            const isDirty = (g.sellPriceUsd ?? null) !== (original ?? null);
            return <tr key={g.priceGroupId} className={"border-t border-border " + (isDirty? 'bg-amber-500/10' : '')}>
            <td className="p-2">{g.priceGroupName}</td>
            <td className="p-2 font-mono" dir="ltr">
              <input
                type="number"
                step="0.001"
                value={g.sellPriceUsd==null? '' : g.sellPriceUsd}
                onChange={e=>updatePrice(g.priceGroupId, e.target.value)}
                className="w-32 px-2 py-1 bg-bg-surface-alt border border-border rounded"
              />
            </td>
            <td className="p-2">
              <div className="flex items-center gap-2">
                <button disabled={savingId===g.priceGroupId || !isDirty} onClick={()=>savePrice(g.priceGroupId)} className="btn btn-xs btn-primary disabled:opacity-40">{savingId===g.priceGroupId? 'Saving...' : isDirty? 'Save' : 'Saved'}</button>
                {isDirty && <span className="text-[10px] uppercase tracking-wide text-warning">dirty</span>}
                {!isDirty && <span className="text-[10px] text-success">✓</span>}
              </div>
            </td>
          </tr>; })}
          {groupPrices.length===0 && <tr><td colSpan={3} className="p-4 text-center opacity-60">No price groups</td></tr>}
        </tbody>
      </table>
      <p className="text-[11px] opacity-60">All amounts in USD (3 decimals). Edit and Save to apply. (TODO: wire real backend endpoint)</p>
    </div>
  </div>;
}
function Info({ label, value }: { label: string; value: any }) {
    return (
      <div className="bg-bg-surface-alt p-3 rounded border border-border">
        <div className="text-xs opacity-60 mb-1">{label}</div>
        <div className="font-mono" dir="ltr">{value}</div>
      </div>
    );
  }
