'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/utils/api';

type CodeItem = {
  id: string;
  pin?: string | null;
  serial?: string | null;
  cost: string;
  status: 'available' | 'reserved' | 'used' | 'disabled' | string;
  orderId?: string | null;
  createdAt: string;
  usedAt?: string | null;
};

const statusLabels: Record<string, string> = {
  available: 'متاح',
  reserved: 'محجوز',
  used: 'مستخدم',
  disabled: 'معطل',
};

function getStatusLabel(status: string) {
  return statusLabels[status] || status;
}

type CodeGroup = { id: string; name: string; publicCode: string; note?: string | null };
type ProductLite = { id: string; name: string };
type PackageLite = { id: string; name: string };

export default function CodeGroupDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const groupId = params?.id;

  const notify = (msg: string) => { if (typeof window !== 'undefined') alert(msg); console.log(msg); };

  const [items, setItems] = useState<CodeItem[]>([]);
  const [products, setProducts] = useState<ProductLite[]>([]);
  const [packages, setPackages] = useState<PackageLite[]>([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('');
  const [cost, setCost] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [adding, setAdding] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'used'>('all');

  const loadAll = async () => {
    try {
      const itemsRes = await api.get<CodeItem[]>(`/admin/codes/groups/${groupId}/items`);
      setItems(itemsRes.data || []);
      const prodsRes = await api.get<ProductLite[]>('/products');
      setProducts(prodsRes.data || []);
    } catch (e: any) { notify(`فشل التحميل: ${e?.response?.data?.message || e.message}`); }
  };

  useEffect(() => { loadAll(); }, [groupId]);

  const onSelectProduct = async (pid: string) => {
    setSelectedProduct(pid);
    if (!pid) { setPackages([]); return; }
    const res = await api.get<any>(`/products/${pid}`);
    setPackages(res.data?.packages?.map((p: any) => ({ id: p.id, name: p.name })) || []);
  };

  const onAddCodes = async () => {
    if (!bulkText.trim()) { notify('الرجاء لصق الأكواد أولاً'); return; }
    setAdding(true);
    try {
      await api.post(`/admin/codes/groups/${groupId}/items/bulk`, { codes: bulkText, cost: cost ? Number(cost) : undefined });
      notify('تمت إضافة الأكواد');
      setBulkText('');
      await loadAll();
      (document.getElementById('bulk-dialog') as HTMLDialogElement)?.close();
    } catch (e: any) { notify(`فشل الإضافة: ${e?.response?.data?.message || e.message}`); }
    finally { setAdding(false); }
  };

  const onDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الكود؟')) return;
    try {
      await api.delete(`/admin/codes/items/${id}`);
      notify('تم الحذف بنجاح');
      setItems(items.filter(i => i.id !== id));
    } catch (e: any) { notify(`فشل الحذف: ${e?.response?.data?.message || e.message}`); }
  };

  const filteredItems = useMemo(() => {
    let list = items;
    if (statusFilter !== 'all') list = list.filter(it => statusFilter === 'available' ? it.status === 'available' : it.status === 'used');
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(it => (it.pin||'').toLowerCase().includes(s) || (it.serial||'').toLowerCase().includes(s) || (it.orderId||'').toLowerCase().includes(s));
    }
    return list;
  }, [items, q, statusFilter]);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* الصف العلوي (منتج + باقة + تكلفة + زر لصق) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4 items-end">
        <div>
          <label className="block text-sm mb-1">المنتج</label>
          <select className="input w-full" value={selectedProduct} onChange={(e)=>onSelectProduct(e.target.value)}>
            <option value="">— اختر منتجًا —</option>
            {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">الباقة</label>
          <select className="input w-full" value={selectedPackage} onChange={(e)=>setSelectedPackage(e.target.value)} disabled={!selectedProduct}>
            <option value="">— اختر باقة —</option>
            {packages.map(pkg=><option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">التكلفة (اختياري)</label>
          <input type="number" className="input w-full" value={cost} onChange={(e)=>setCost(e.target.value)} placeholder="0.00"/>
        </div>
        <div>
          <button className="btn btn-primary w-full" onClick={()=> (document.getElementById('bulk-dialog') as HTMLDialogElement)?.showModal()}>
            + لصق أكواد
          </button>
        </div>
      </div>

      {/* جدول الأكواد */}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th><th>PIN</th><th>SERIAL</th><th>الحالة</th><th>التكلفة</th><th>الطلب</th><th>أضيفت</th><th>استُخدمت</th><th>إجراءات</th>
            </tr>
          </thead>
            <tbody>
            {filteredItems.length === 0 ? (
                <tr>
                <td colSpan={9} className="px-3 py-3">لا توجد أكواد</td>
                </tr>
            ) : (
                filteredItems.map((it, idx) => (
                <tr key={it.id}>
                    <td>{idx + 1}</td>
                    <td className="font-mono">{it.pin || '-'}</td>
                    <td className="font-mono">{it.serial || '-'}</td>
                    <td>
                    <span
                        className={`badge ${
                        it.status === 'available'
                            ? 'badge-success'
                            : it.status === 'used'
                            ? 'badge-warning'
                            : it.status === 'disabled'
                            ? 'badge-danger'
                            : 'badge-warning'
                        }`}
                    >
                        {getStatusLabel(it.status)}
                    </span>
                    </td>
                    <td>{Number(it.cost || '0').toFixed(2)}</td>
                    <td>{it.orderId ? it.orderId.slice(0, 8) + '…' : '-'}</td>
                    <td>{new Date(it.createdAt).toLocaleString()}</td>
                    <td>{it.usedAt ? new Date(it.usedAt).toLocaleString() : '-'}</td>
                    <td>
                    <button
                        onClick={() => onDelete(it.id)}
                        className="btn btn-ghost text-red-500"
                    >
                        🗑️ حذف
                    </button>
                    </td>
                </tr>
                ))
            )}
            </tbody>
        </table>
      </div>

      {/* Dialog لصق الأكواد */}
      <dialog id="bulk-dialog" className="modal">
        <form className="modal-box card w-[95vw] max-w-2xl" onSubmit={(e)=>{e.preventDefault();onAddCodes();}}>
          <h3 className="text-lg font-bold mb-2">إضافة أكواد دفعة واحدة</h3>
          <textarea className="input w-full font-mono" rows={12} value={bulkText} onChange={(e)=>setBulkText(e.target.value)} placeholder="AAA-BBB-CCC;SERIAL-123"/>
          <div className="mt-4 flex justify-between">
            <button type="button" className="btn btn-secondary" onClick={()=> (document.getElementById('bulk-dialog') as HTMLDialogElement)?.close()}>إلغاء</button>
            <button type="submit" disabled={adding} className="btn btn-primary">{adding?'جارٍ الإضافة…':'إضافة الأكواد'}</button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
