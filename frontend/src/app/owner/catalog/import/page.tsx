"use client";
import React,{useEffect,useState} from 'react';
import api,{ API_ROUTES } from '@/utils/api';

interface CatalogProduct { id:string; name:string; provider?:string; packages?:any[]; }

export default function CatalogImportPage(){
  const [rows,setRows]=useState<CatalogProduct[]>([]); const [loading,setLoading]=useState(true); const [err,setErr]=useState<any>(null);
  const [selected,setSelected]=useState<Record<string,boolean>>({});
  useEffect(()=>{(async()=>{try{const r=await api.get(API_ROUTES.admin.catalog.listProducts(true)); const data=(r.data?.items||r.data||[]).filter((p:any)=> (p.packages?.length||0) >=2); setRows(data);}catch(e:any){setErr(e);}finally{setLoading(false);} })();},[]);
  const toggle=(id:string)=>setSelected(s=>({...s,[id]:!s[id]}));
  const selectedIds=Object.entries(selected).filter(([,v])=>v).map(([k])=>k);
  const publish=async()=>{ // TODO backend queue endpoint
    console.log('publish queue', selectedIds);
    alert('Queued '+selectedIds.length+' products (stub)');
  };
  return <div className="space-y-4"><h1 className="text-xl font-semibold">Catalog Import</h1>
    {loading && <div>Loading...</div>}
    {err && <div className="text-danger text-sm">Failed loading</div>}
    <div className="flex gap-2"><button disabled={!selectedIds.length} onClick={publish} className="btn btn-sm btn-primary">Queue Publish ({selectedIds.length})</button></div>
    <table className="w-full text-sm border border-border"><thead className="bg-bg-surface-alt"><tr>
      <th className="p-2"></th><th className="p-2 text-right">Name</th><th className="p-2 text-right">Provider</th><th className="p-2 text-right">Packages</th>
    </tr></thead><tbody>
      {rows.map(p=> <tr key={p.id} className="border-t border-border">
        <td className="p-2"><input type="checkbox" checked={!!selected[p.id]} onChange={()=>toggle(p.id)} /></td>
        <td className="p-2">{p.name}</td>
        <td className="p-2">{p.provider||'-'}</td>
        <td className="p-2" dir="ltr">{p.packages?.length||0}</td>
      </tr>)}
      {!loading && rows.length===0 && <tr><td colSpan={4} className="p-4 text-center opacity-60">No products</td></tr>}
    </tbody></table>
  </div>;
}
