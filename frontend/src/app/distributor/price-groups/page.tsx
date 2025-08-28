"use client";
import { useEffect, useState } from 'react';
import api from '@/utils/api';

interface PriceGroup { id: string; name: string; createdAt?: string; }

export default function DistributorPriceGroupsPage() {
  const [groups,setGroups]=useState<PriceGroup[]>([]);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState<any>(null);
  const [newName,setNewName]=useState('');

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try {
        const r = await api.get('/distributor/price-groups');
        const raw:any = r.data;
        let arr:PriceGroup[] = [];
        if (Array.isArray(raw)) arr = raw;
        else if (raw && typeof raw==='object' && Array.isArray(raw.items)) arr = raw.items;
        setGroups(arr);
      } catch(e:any){
        setErr(e);
      } finally {
        setLoading(false);
      }
    })();
  },[]);

  const create = async ()=>{
    if(!newName.trim()) return;
    const r = await api.post('/distributor/price-groups',{ name:newName.trim() });
    setGroups(g=>[...g, r.data]);
    setNewName('');
  };

  return <div className="space-y-4">
    <h1 className="text-xl font-semibold">Distributor Price Groups</h1>
    {loading && <div>Loading...</div>}
    {err && <div className="text-red-500 text-sm">Error</div>}
    <div className="flex gap-2">
      <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="New group" className="px-2 py-1 border border-border rounded bg-bg-surface" />
      <button onClick={create} disabled={!newName.trim()} className="px-3 py-1 bg-primary text-white rounded disabled:opacity-40 text-sm">Create</button>
    </div>
    <ul className="space-y-1">
      {groups.map(g=> <li key={g.id} className="p-2 bg-bg-surface-alt border border-border rounded text-sm">{g.name}</li>)}
      {!groups.length && !loading && <li className="text-xs opacity-60">No groups</li>}
    </ul>
  </div>;
}
