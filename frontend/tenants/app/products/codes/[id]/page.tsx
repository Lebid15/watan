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

  // بيانات وهمية كأمثلة
  const dummyItems: CodeItem[] = [
    {
      id: 'dummy-1',
      pin: 'XXXX-YYYY-ZZZZ-1234',
      serial: 'SN-2024-001-ABC',
      cost: '5.99',
      status: 'available',
      orderId: null,
      createdAt: new Date().toISOString(),
      usedAt: null,
    },
    {
      id: 'dummy-2',
      pin: 'AAAA-BBBB-CCCC-5678',
      serial: 'SN-2024-002-DEF',
      cost: '5.99',
      status: 'used',
      orderId: 'ORD-123456',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      usedAt: new Date().toISOString(),
    },
    {
      id: 'dummy-3',
      pin: 'QQQQ-WWWW-EEEE-9012',
      serial: 'SN-2024-003-GHI',
      cost: '5.99',
      status: 'available',
      orderId: null,
      createdAt: new Date(Date.now() - 172800000).toISOString(),
      usedAt: null,
    },
  ];

  const loadAll = async () => {
    try {
      const itemsRes = await api.get(`/admin/codes/groups/${groupId}/items`) as any;
      const itemsData = Array.isArray(itemsRes.data) 
        ? itemsRes.data 
        : Array.isArray(itemsRes.data?.items) 
        ? itemsRes.data.items 
        : [];
      setItems(itemsData);
      
      const prodsRes = await api.get('/products') as any;
      const prodsData = Array.isArray(prodsRes.data)
        ? prodsRes.data
        : Array.isArray(prodsRes.data?.items)
        ? prodsRes.data.items
        : [];
      setProducts(prodsData);
    } catch (e: any) { 
      notify(`فشل التحميل: ${e?.response?.data?.message || e.message}`);
      setItems([]);
      setProducts([]);
    }
  };

  useEffect(() => { loadAll(); }, [groupId]);

  const onSelectProduct = async (pid: string) => {
    setSelectedProduct(pid);
    if (!pid) { setPackages([]); return; }
    try {
      const res = await api.get(`/products/${pid}`) as any;
      const productData = res.data;
      if (productData && Array.isArray(productData.packages)) {
        setPackages(productData.packages.map((p: any) => ({ id: p.id, name: p.name })));
      } else {
        setPackages([]);
      }
    } catch (e) {
      setPackages([]);
    }
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
    if (isDummyData) return;
    if (!confirm('هل أنت متأكد من حذف هذا الكود؟')) return;
    try {
      await api.delete(`/admin/codes/items/${id}`);
      notify('تم الحذف بنجاح');
      setItems(items.filter(i => i.id !== id));
    } catch (e: any) { notify(`فشل الحذف: ${e?.response?.data?.message || e.message}`); }
  };

  const filteredItems = useMemo(() => {
    // استخدام البيانات الوهمية إذا كان الجدول فارغاً
    let list = items.length > 0 ? items : dummyItems;
    list = Array.isArray(list) ? list : [];
    if (statusFilter !== 'all') list = list.filter(it => statusFilter === 'available' ? it.status === 'available' : it.status === 'used');
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(it => (it.pin||'').toLowerCase().includes(s) || (it.serial||'').toLowerCase().includes(s) || (it.orderId||'').toLowerCase().includes(s));
    }
    return list;
  }, [items, q, statusFilter, dummyItems]);

  const isDummyData = items.length === 0 && filteredItems.length > 0;

  return (
    <div className="p-4 md:p-6 text-text-primary min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push('/products/codes')}
          className="
            p-2 rounded-lg
            bg-bg-surface border border-border
            hover:bg-bg-surface-alt
            transition-all duration-200
          "
          title="رجوع"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <span className="text-2xl">📄</span>
        <h1 className="text-2xl font-bold text-text-primary">إدارة الأكواد</h1>
      </div>

      {/* أدوات الإضافة */}
      <div className="mb-6 p-6 rounded-xl border border-border bg-bg-surface shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">➕</span>
          <h3 className="text-lg font-bold">إضافة أكواد جديدة</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-2 text-text-primary">المنتج</label>
          <select 
            className="
              w-full px-4 py-2.5 rounded-lg
              bg-bg-input border border-border
              text-text-primary
              focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
              transition-all duration-200
            " 
            value={selectedProduct} 
            onChange={(e)=>onSelectProduct(e.target.value)}
          >
            <option value="">— اختر منتجًا —</option>
            {products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-text-primary">الباقة</label>
          <select 
            className="
              w-full px-4 py-2.5 rounded-lg
              bg-bg-input border border-border
              text-text-primary
              focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            " 
            value={selectedPackage} 
            onChange={(e)=>setSelectedPackage(e.target.value)} 
            disabled={!selectedProduct}
          >
            <option value="">— اختر باقة —</option>
            {packages.map(pkg=><option key={pkg.id} value={pkg.id}>{pkg.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-text-primary">التكلفة (اختياري)</label>
          <input 
            type="number" 
            className="
              w-full px-4 py-2.5 rounded-lg
              bg-bg-input border border-border
              text-text-primary placeholder:text-text-secondary
              focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
              transition-all duration-200
            " 
            value={cost} 
            onChange={(e)=>setCost(e.target.value)} 
            placeholder="0.00"
            step="0.01"
          />
        </div>
        <div>
          <button 
            className="
              w-full px-5 py-2.5 rounded-lg font-bold text-sm
              bg-gradient-to-r from-green-600 to-green-500 text-white
              hover:from-green-700 hover:to-green-600 hover:shadow-lg
              transition-all duration-200
              flex items-center justify-center gap-2
            " 
            onClick={()=> (document.getElementById('bulk-dialog') as HTMLDialogElement)?.showModal()}
          >
            <span className="text-lg">+</span>
            <span>لصق أكواد</span>
          </button>
        </div>
        </div>
      </div>

      {/* الفلاتر */}
      <div className="mb-6 p-4 rounded-xl border border-border bg-bg-surface shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
          <div className="flex gap-2">
            <button 
              onClick={() => setStatusFilter('all')} 
              className={`
                px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-200
                ${statusFilter === 'all' 
                  ? 'bg-primary text-primary-contrast shadow-md' 
                  : 'bg-bg-surface-alt text-text-primary hover:bg-primary/10'
                }
              `}
            >
              الكل
            </button>
            <button 
              onClick={() => setStatusFilter('available')} 
              className={`
                px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-200
                ${statusFilter === 'available' 
                  ? 'bg-green-600 text-white shadow-md' 
                  : 'bg-bg-surface-alt text-text-primary hover:bg-green-600/10'
                }
              `}
            >
              المتاحة
            </button>
            <button 
              onClick={() => setStatusFilter('used')} 
              className={`
                px-4 py-2 rounded-lg font-medium text-sm
                transition-all duration-200
                ${statusFilter === 'used' 
                  ? 'bg-orange-600 text-white shadow-md' 
                  : 'bg-bg-surface-alt text-text-primary hover:bg-orange-600/10'
                }
              `}
            >
              المستخدمة
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              placeholder="بحث بـ PIN أو SERIAL أو رقم الطلب..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="
                px-4 py-2 rounded-lg
                bg-bg-input border border-border
                text-text-primary placeholder:text-text-secondary
                focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                transition-all duration-200
                w-full md:w-80
              "
            />
            <button 
              onClick={loadAll} 
              className="
                px-4 py-2 rounded-lg font-medium text-sm
                bg-blue-600 text-white
                hover:bg-blue-700 hover:shadow-md
                transition-all duration-200
                flex items-center gap-2
              "
            >
              <span>🔄</span>
              <span>تحديث</span>
            </button>
          </div>
        </div>
      </div>

      {/* جدول الأكواد */}
      <div className="overflow-auto rounded-xl border border-border shadow-lg bg-bg-surface">
        <table className="min-w-full w-full text-sm">
          <thead className="bg-gradient-to-l from-primary/10 to-primary/5 border-b-2 border-primary/20">
            <tr>
              <th className="px-4 py-4 font-bold text-text-primary text-right whitespace-nowrap">#</th>
              <th className="px-4 py-4 font-bold text-text-primary text-right whitespace-nowrap">PIN</th>
              <th className="px-4 py-4 font-bold text-text-primary text-right whitespace-nowrap">SERIAL</th>
              <th className="px-4 py-4 font-bold text-text-primary text-right whitespace-nowrap">الحالة</th>
              <th className="px-4 py-4 font-bold text-text-primary text-right whitespace-nowrap">التكلفة</th>
              <th className="px-4 py-4 font-bold text-text-primary text-right whitespace-nowrap">الطلب</th>
              <th className="px-4 py-4 font-bold text-text-primary text-right whitespace-nowrap">تاريخ الإضافة</th>
              <th className="px-4 py-4 font-bold text-text-primary text-right whitespace-nowrap">تاريخ الاستخدام</th>
              <th className="px-4 py-4 font-bold text-text-primary text-right whitespace-nowrap">إجراءات</th>
            </tr>
          </thead>
            <tbody>
            {filteredItems.length === 0 ? (
                <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-5xl opacity-50">📭</span>
                    <span className="text-text-secondary text-lg">لا توجد أكواد</span>
                  </div>
                </td>
                </tr>
            ) : (
                filteredItems.map((it, idx) => (
                <tr 
                  key={it.id}
                  className={`
                    transition-all duration-200
                    ${idx % 2 === 0 ? 'bg-bg-surface' : 'bg-bg-surface-alt'}
                    hover:bg-primary/5 hover:shadow-sm
                    border-b border-border/30
                  `}
                >
                    <td className="px-4 py-3 text-text-secondary">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-text-primary">{it.pin || '—'}</td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-text-primary">{it.serial || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center" title={getStatusLabel(it.status)}>
                        {it.status === 'available' ? (
                          <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        ) : it.status === 'used' ? (
                          <svg className="w-6 h-6 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        ) : it.status === 'disabled' ? (
                          <svg className="w-6 h-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                        ) : it.status === 'reserved' ? (
                          <svg className="w-6 h-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{Number(it.cost || '0').toFixed(2)} $</td>
                    <td className="px-4 py-3">
                      {it.orderId ? (
                        <code className="px-2 py-1 rounded bg-primary/15 text-primary font-mono text-xs">
                          {it.orderId.slice(0, 8)}...
                        </code>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-sm font-mono">
                      {new Date(it.createdAt).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 text-text-secondary text-sm font-mono">
                      {it.usedAt ? new Date(it.usedAt).toLocaleDateString('en-GB') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onDelete(it.id)}
                        className="
                          px-3 py-1.5 rounded-lg font-medium text-xs
                          bg-red-600 text-white
                          hover:bg-red-700 hover:shadow-md
                          transition-all duration-200
                          flex items-center gap-1
                        "
                      >
                        <span>🗑️</span>
                        <span>حذف</span>
                      </button>
                    </td>
                </tr>
                ))
            )}
            </tbody>
        </table>
      </div>

      {/* Dialog لصق الأكواد */}
      <dialog id="bulk-dialog" className="rounded-xl backdrop:bg-black/60">
        <div className="w-[95vw] max-w-3xl bg-bg-surface border border-border rounded-xl shadow-2xl p-0 overflow-hidden">
          <form onSubmit={(e)=>{e.preventDefault();onAddCodes();}}>
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 border-b border-border px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📋</span>
                <h3 className="text-xl font-bold text-text-primary">إضافة أكواد دفعة واحدة</h3>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2 text-text-primary">
                  الصق الأكواد هنا (كل كود في سطر، بصيغة: PIN;SERIAL)
                </label>
                <div className="text-xs text-text-secondary mb-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <span>💡</span>
                    <div>
                      <p className="font-medium mb-1">مثال على التنسيق:</p>
                      <code className="block font-mono text-xs bg-bg-input px-2 py-1 rounded mt-1">
                        AAA-BBB-CCC;SERIAL-123<br/>
                        DDD-EEE-FFF;SERIAL-456
                      </code>
                    </div>
                  </div>
                </div>
                <textarea 
                  className="
                    w-full px-4 py-3 rounded-lg font-mono text-sm
                    bg-bg-input border border-border
                    text-text-primary placeholder:text-text-secondary
                    focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                    transition-all duration-200
                    resize-none
                  " 
                  rows={12} 
                  value={bulkText} 
                  onChange={(e)=>setBulkText(e.target.value)} 
                  placeholder="AAA-BBB-CCC;SERIAL-123&#10;DDD-EEE-FFF;SERIAL-456&#10;GGG-HHH-III;SERIAL-789"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="bg-bg-surface-alt border-t border-border px-6 py-4 flex justify-between items-center gap-4">
              <button 
                type="button" 
                className="
                  px-6 py-2.5 rounded-lg font-medium text-sm
                  bg-bg-surface border border-border text-text-primary
                  hover:bg-bg-surface-alt hover:shadow-md
                  transition-all duration-200
                " 
                onClick={()=> (document.getElementById('bulk-dialog') as HTMLDialogElement)?.close()}
              >
                ❌ إلغاء
              </button>
              <button 
                type="submit" 
                disabled={adding}
                className="
                  px-6 py-2.5 rounded-lg font-bold text-sm
                  bg-gradient-to-r from-green-600 to-green-500 text-white
                  hover:from-green-700 hover:to-green-600 hover:shadow-lg
                  disabled:opacity-50 disabled:cursor-not-allowed
                  transition-all duration-200
                  flex items-center gap-2
                "
              >
                {adding ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>جارٍ الإضافة...</span>
                  </>
                ) : (
                  <>
                    <span>✅</span>
                    <span>إضافة الأكواد</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </div>
  );
}
