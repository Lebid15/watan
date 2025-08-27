"use client";
import React,{useState} from 'react';
import api from '@/utils/api';

export default function CatalogNewProduct(){
  const [name,setName]=useState('');
  const [saving,setSaving]=useState(false);
  const save=async()=>{ if(!name.trim()) return; setSaving(true); try { await api.post('/owner/catalog/products',{ name:name.trim(), linkCodes:[] /* TODO */ }); alert('Created (stub)'); setName(''); } finally { setSaving(false);} };
  return <div className="space-y-4"><h1 className="text-xl font-semibold">New Manual Product</h1>
    <div className="flex gap-2"><input className="px-2 py-1 bg-bg-surface-alt border border-border rounded" value={name} onChange={e=>setName(e.target.value)} placeholder="Name" />
      <button disabled={saving} onClick={save} className="btn btn-sm btn-primary">Create</button></div>
    <p className="text-xs opacity-60">TODO: add packages & linkCodes selection once backend endpoints confirmed.</p>
  </div>;
}
