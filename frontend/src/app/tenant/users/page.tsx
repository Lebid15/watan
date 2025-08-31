"use client";
import React, { useEffect, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';

interface TenantUser { id:string; email:string; name?:string; priceGroupId?:string|null; }
interface PriceGroup { id:string; name:string; }

export default function TenantUsersPage(){
  const [users,setUsers]=useState<TenantUser[]>([]);
  const [priceGroups,setPriceGroups]=useState<PriceGroup[]>([]);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState<any>(null);
  const [assigning,setAssigning]=useState<string|null>(null);
  const isUser = (v:any): v is TenantUser => !!v && typeof v==='object' && typeof v.id==='string' && typeof v.email==='string';
  const isPriceGroup = (v:any): v is PriceGroup => !!v && typeof v==='object' && typeof v.id==='string' && typeof v.name==='string';
  const normUsers = (raw:unknown):TenantUser[] => {
    if(Array.isArray(raw)) return raw.filter(isUser);
    if(raw && typeof raw==='object' && Array.isArray((raw as any).items)) return (raw as any).items.filter(isUser);
    return [];
  };
  const normPriceGroups = (raw:unknown):PriceGroup[] => {
    if(Array.isArray(raw)) return raw.filter(isPriceGroup);
    if(raw && typeof raw==='object' && Array.isArray((raw as any).items)) return (raw as any).items.filter(isPriceGroup);
    return [];
  };
  useEffect(()=>{(async()=>{
    try {
      const [u,pg]=await Promise.all([
        api.get(API_ROUTES.users.withPriceGroup),
        api.get(API_ROUTES.priceGroups.base),
      ]);
      setUsers(normUsers((u as any)?.data));
      setPriceGroups(normPriceGroups((pg as any)?.data));
    } catch(e:any){ setErr(e); } finally { setLoading(false); }
  })();},[]);

  const assign = async (userId:string, priceGroupId:string|null)=>{
    setAssigning(userId);
    try {
      await api.post(`/users/${userId}/price-group`, { priceGroupId }); // TODO backend endpoint verify path
      setUsers(us=>us.map(u=>u.id===userId?{...u, priceGroupId}:u));
    } finally { setAssigning(null); }
  };

  return <div className="space-y-4">
    <h1 className="text-xl font-semibold">Users</h1>
    {loading && <div>Loading...</div>}
    {err && <div className="text-danger text-sm">Failed loading</div>}
    <table className="w-full text-sm border border-border">
      <thead className="bg-bg-surface-alt"><tr>
        <th className="p-2 text-right">Email</th>
        <th className="p-2 text-right">Price Group</th>
      </tr></thead>
      <tbody>
        {users.map(u=> <tr key={u.id} className="border-t border-border">
          <td className="p-2">{u.email}</td>
          <td className="p-2">
            <select disabled={assigning===u.id} value={u.priceGroupId||''} onChange={e=>assign(u.id, e.target.value||null)} className="bg-bg-surface-alt border border-border rounded px-2 py-1">
              <option value="">(None)</option>
              {priceGroups.map(pg=> <option key={pg.id} value={pg.id}>{pg.name}</option>)}
            </select>
          </td>
        </tr>)}
        {!loading && users.length===0 && <tr><td colSpan={2} className="p-4 text-center opacity-60">No users</td></tr>}
      </tbody>
    </table>
  </div>;
}
