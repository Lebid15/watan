"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api, { API_ROUTES } from '@/utils/api';
import Link from 'next/link';
import { formatMoney3 } from '@/utils/format';

export default function TenantProductDetails(){
  const params = useParams();
  const id = params?.id as string;
  const [p,setP]=useState<any>(null); const [loading,setLoading]=useState(true); const [err,setErr]=useState<any>(null);
  useEffect(()=>{ if(!id) return; (async()=>{ try{ const r=await api.get(API_ROUTES.products.byId(id)); setP(r.data); }catch(e:any){setErr(e);}finally{setLoading(false);} })(); },[id]);
  if(loading) return <div>Loading...</div>;
  if(err) return <div className="text-danger">Error loading product.</div>;
  if(!p) return <div>Not found.</div>;
  return <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">{p.name}</h1>
      <Link href={`/tenant/products/${id}/packages`} className="btn btn-sm">Packages</Link>
    </div>
    <div className="grid md:grid-cols-3 gap-3 text-sm">
      <Info label="Base" value={formatMoney3(p.basePriceUsd||0)} />
      <Info label="Capital" value={formatMoney3(p.capitalPriceUsd||0)} />
    </div>
  </div>;
}
function Info({label,value}:{label:string;value:any}){return <div className="bg-bg-surface-alt p-3 rounded border border-border"><div className="text-xs opacity-60 mb-1">{label}</div><div className="font-mono" dir="ltr">{value}</div></div>;}
