'use client';
import { useEffect, useMemo, useState } from 'react';
import api, { API_ROUTES, Api } from '@/utils/api';

type Tenant = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  deletedAt?: string | null;
  ownerEmail?: string | null;
  ownerName?: string | null;
  domains?: { id: string; domain: string; isPrimary?: boolean }[];
};

type Paged<T> = { items: T[]; total: number; page: number; limit: number };

function Banner() {
  return (
    <div className="mb-4 rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900">
      <div className="font-semibold">Admin → Tenants</div>
      <div className="text-sm">
        Manage tenants: edit name/code/owner, trash/restore with conflict suggestions, and hard delete when safe.
      </div>
    </div>
  );
}

function useFeatureFlagAdminTenants() {
  // Lightweight check: fetch server health/config from profile call if available.
  // We reuse profile-with-currency which we already cache via Api.me().
  const [ok, setOk] = useState<boolean | null>(null);
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await Api.me();
        const user = res?.data || {};
        const r = String((user.role || user.user?.role || '')).toLowerCase();
        setRole(r);
        // Server exposes flags through /api/tenant/current or env echoed headers? Fallback to cookie-less probe:
        // Minimal GET to /api/health, then rely on server to hide endpoints if flag off — we also hide UI unless admin/owner.
        const allow = r === 'admin' || r === 'instance_owner' || r === 'tenant_owner';
        setOk(allow);
      } catch {
        setOk(false);
      }
    })();
    return () => { mounted = false; };
  }, []);
  return { allowed: ok, role };
}

export default function TenantsPageClient() {
  const { allowed } = useFeatureFlagAdminTenants();
  const [status, setStatus] = useState<'active'|'trashed'|'all'>('active');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Paged<Tenant>>({ items: [], total: 0, page: 1, limit: 20 });

  const [editing, setEditing] = useState<Tenant | null>(null);
  const [editFields, setEditFields] = useState<{ name: string; code: string; ownerEmail: string; ownerName: string }>({ name: '', code: '', ownerEmail: '', ownerName: '' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success'|'error'; msg: string } | null>(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((data?.total || 0) / (data?.limit || limit))), [data, limit]);

  async function load() {
    setLoading(true); setError(null);
    try {
      const url = API_ROUTES.admin.tenants.list({ status, page, limit, search: search.trim() || undefined });
      const res = await api.get(url.replace('/api/tenants?', '/api/tenants?')); // keep as is
  const body = res.data;
  // Service returns {items,total,page,limit} or raw array; normalize defensively
  const payload: any = body && typeof body === 'object' && !Array.isArray(body) && body.data ? body.data : body;
  let items: any = Array.isArray(payload) ? payload : (Array.isArray(payload?.items) ? payload.items : []);
  const total: number = (typeof payload?.total === 'number') ? payload.total : (Array.isArray(items) ? items.length : 0);
  const norm: Paged<Tenant> = { items, total, page: payload?.page || page, limit: payload?.limit || limit };
      setData(norm);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load');
    } finally { setLoading(false); }
  }

  useEffect(() => { if (allowed) load(); }, [allowed, status, page, limit]);

  function showToast(type: 'success'|'error', msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2500);
  }

  function openEdit(t: Tenant) {
    setEditing(t);
    setEditFields({
      name: t.name || '',
      code: t.code || '',
      ownerEmail: t.ownerEmail || '',
      ownerName: t.ownerName || '',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const payload: any = { name: editFields.name, code: editFields.code, ownerEmail: editFields.ownerEmail, ownerName: editFields.ownerName };
      await api.patch(API_ROUTES.admin.tenants.update(editing.id), payload);
      setEditing(null);
      showToast('success', 'Saved');
      await load();
    } catch (e: any) {
      // handle 409 suggestion on rename
      const d = e?.response?.data;
      if (e?.response?.status === 409 && d?.suggestion?.code) {
        showToast('error', `Conflict: code in use. Suggested: ${d.suggestion.code}`);
      } else {
        showToast('error', d?.message || 'Save failed');
      }
    } finally { setSaving(false); }
  }

  async function doTrash(t: Tenant) {
    if (!confirm(`Trash tenant ${t.name} (${t.code})?`)) return;
    try { await api.post(API_ROUTES.admin.tenants.trash(t.id)); showToast('success', 'Trashed'); await load(); }
    catch (e: any) { showToast('error', e?.response?.data?.message || 'Trash failed'); }
  }

  async function doRestore(t: Tenant) {
    try { await api.post(API_ROUTES.admin.tenants.restore(t.id)); showToast('success', 'Restored'); await load(); }
    catch (e: any) {
      const d = e?.response?.data;
      if (e?.response?.status === 409 && d?.suggestion) {
        const suggested = d?.suggestion?.code as string | undefined;
        const domainsMap = d?.suggestion?.domains as Record<string,string> | undefined;
        let msg = 'Conflicts detected.';
        if (suggested) msg += ` Suggested code: ${suggested}.`;
        if (domainsMap && Object.keys(domainsMap).length) msg += ` Domain suggestions: ${Object.entries(domainsMap).map(([k,v])=>`${k}→${v}`).join(', ')}`;
        if (confirm(`${msg}\nApply suggestion and retry?`)) {
          try {
            if (suggested) await api.patch(API_ROUTES.admin.tenants.update(t.id), { code: suggested });
            await api.post(API_ROUTES.admin.tenants.restore(t.id));
            showToast('success', 'Restored');
            await load();
            return;
          } catch (ee: any) {
            showToast('error', ee?.response?.data?.message || 'Retry failed');
          }
        }
      } else {
        showToast('error', d?.message || 'Restore failed');
      }
    }
  }

  async function doHardDelete(t: Tenant) {
    const code = prompt(`Type tenant code to confirm hard delete: ${t.code}`);
    if (!code) return;
    try {
      await api.delete(API_ROUTES.admin.tenants.hardDelete(t.id, code));
      showToast('success', 'Hard deleted');
      await load();
    } catch (e: any) {
      const d = e?.response?.data;
      showToast('error', d?.message || d?.error || 'Hard delete failed');
    }
  }

  if (allowed === null) return null;
  if (!allowed) return <div className="p-4 text-red-600">Access denied.</div>;

  return (
    <div className="p-4">
      <Banner />
  <div className="mb-3 text-xs text-gray-600">ملاحظة: يظهر زر "حذف نهائي" فقط بعد نقل المتجر إلى سلة المهملات.</div>

      {toast && (
        <div className={`mb-3 rounded p-2 text-sm ${toast.type==='success'?'bg-green-100 text-green-800':'bg-red-100 text-red-800'}`}>{toast.msg}</div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-sm">Status:</label>
        <select className="select select-bordered select-sm" value={status} onChange={e=>{setStatus(e.target.value as any); setPage(1);}}>
          <option value="active">Active</option>
          <option value="trashed">Trashed</option>
          <option value="all">All</option>
        </select>
        <input className="input input-bordered input-sm w-64" placeholder="Search code or domain" value={search} onChange={e=>setSearch(e.target.value)} />
        <button className="btn btn-sm" onClick={()=>{ setPage(1); load(); }}>Search</button>
      </div>

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Code</th>
              <th>Owner</th>
              <th>Domains</th>
              <th>Status</th>
              <th className="text-right">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-6 text-center">Loading...</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="py-6 text-center text-red-600">{error}</td></tr>
            ) : (!Array.isArray(data.items) || data.items.length === 0) ? (
              <tr><td colSpan={6} className="py-6 text-center text-gray-500">No tenants</td></tr>
      ) : (Array.isArray(data.items) ? data.items : []).map((t: any) => (
              <tr key={t.id} className={!t.isActive ? 'opacity-70' : ''}>
                <td>{t.name}</td>
                <td><span className="font-mono">{t.code}</span></td>
                <td>{t.ownerName ? `${t.ownerName} <${t.ownerEmail||''}>` : (t.ownerEmail||'-')}</td>
        <td>{(Array.isArray(t.domains)?t.domains:[])
          .slice(0,3)
          .map((d:any)=> typeof d === 'string' ? d : d?.domain)
          .filter(Boolean)
          .join(', ')}{(Array.isArray(t.domains)?t.domains:[]).length>3?'…':''}</td>
                <td>{t.deletedAt ? 'Trashed' : (t.isActive ? 'Active' : 'Inactive')}</td>
                <td className="text-right space-x-1">
                  <button className="btn btn-xs" onClick={()=>openEdit(t)}>تعديل</button>
                  {!t.deletedAt && (
                    <button className="btn btn-xs btn-warning" onClick={()=>doTrash(t)}>حذف</button>
                  )}
                  {t.deletedAt && (
                    <>
                      <button className="btn btn-xs btn-success" onClick={()=>doRestore(t)}>استعادة</button>
                      <button className="btn btn-xs btn-error" onClick={()=>doHardDelete(t)}>حذف نهائي</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button className="btn btn-sm" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
        <span className="text-sm">Page {page} / {totalPages}</span>
        <button className="btn btn-sm" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next</button>
        <select className="select select-bordered select-sm ml-2" value={limit} onChange={e=>{setLimit(parseInt(e.target.value)||20); setPage(1);}}>
          {[10,20,50,100].map(n=> <option key={n} value={n}>{n}/page</option>)}
        </select>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <div className="w-[520px] max-w-[95vw] rounded-md bg-white p-4 shadow">
            <div className="mb-3 text-lg font-semibold">Edit tenant</div>
            <div className="space-y-2">
              <label className="block text-sm">Name
                <input className="input input-bordered input-sm w-full" value={editFields.name} onChange={e=>setEditFields(s=>({...s,name:e.target.value}))} />
              </label>
              <label className="block text-sm">Code (slug)
                <input className="input input-bordered input-sm w-full font-mono" value={editFields.code} onChange={e=>setEditFields(s=>({...s,code:e.target.value}))} />
              </label>
              <label className="block text-sm">Owner email
                <input className="input input-bordered input-sm w-full" value={editFields.ownerEmail} onChange={e=>setEditFields(s=>({...s,ownerEmail:e.target.value}))} />
              </label>
              <label className="block text-sm">Owner full name
                <input className="input input-bordered input-sm w-full" value={editFields.ownerName} onChange={e=>setEditFields(s=>({...s,ownerName:e.target.value}))} />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn btn-sm" onClick={()=>setEditing(null)}>Cancel</button>
              <button className={`btn btn-sm btn-primary ${saving?'opacity-70':''}`} disabled={saving} onClick={saveEdit}>{saving?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
