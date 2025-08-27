"use client";
import React,{useEffect,useState} from 'react';
import api from '@/utils/api';
import { formatMoney3 } from '@/utils/format';

interface PriceGroup { id:string; name:string; preferredCurrency?:string; }

export default function DistributorPriceGroups(){
  const [groups,setGroups]=useState<PriceGroup[]>([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<any>(null);
  const [newName,setNewName]=useState('');
  useEffect(()=>{(async()=>{try{const r=await api.get('/distributor/price-groups');setGroups(r.data||[]);}catch(e:any){setErr(e);}finally{setLoading(false);} })();},[]);
  const create=async()=>{if(!newName.trim())return;const r=await api.post('/distributor/price-groups',{name:newName.trim()});setGroups(g=>[...g,r.data]);setNewName('');};
  return <div className="space-y-4">
    <h1 className="text-xl font-semibold">Distributor Price Groups</h1>
    <div className="flex gap-2"><input className="px-2 py-1 bg-bg-surface-alt border border-border rounded" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="New group name" /><button onClick={create} className="btn btn-sm btn-primary">Create</button></div>
    {loading && <div>Loading...</div>}
    {err && <div className="text-danger text-sm">Failed loading</div>}
    <table className="w-full text-sm border border-border"><thead className="bg-bg-surface-alt"><tr>
      <th className="p-2 text-right">Name</th>
      <th className="p-2 text-right">Preferred Currency</th>
    </tr></thead><tbody>
      {groups.map(g=> <tr key={g.id} className="border-t border-border"><td className="p-2">{g.name}</td><td className="p-2">{g.preferredCurrency||'-'}</td></tr>)}
      {!loading && groups.length===0 && <tr><td colSpan={2} className="p-4 text-center opacity-60">No groups</td></tr>}
    </tbody></table>
  </div>;
}
