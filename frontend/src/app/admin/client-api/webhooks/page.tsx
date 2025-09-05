"use client";
import React, { useEffect, useState, useCallback } from 'react';
import AdminShell from '../../../../components/admin/AdminShell';

interface OutboxRow {
  id: string;
  status: string;
  attempt_count: number;
  next_attempt_at?: string | null;
  last_error?: string | null;
  response_code?: number | null;
  event_type: string;
  created_at: string;
  updated_at: string;
}

interface Stats {
  pending: number; delivering: number; failed: number; dead: number; succeeded: number; succeededToday: number;
}

const POLL_INTERVAL = 10000;

export default function ClientApiWebhooksPage() {
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, listRes] = await Promise.all([
        fetch('/api/tenant/client-api/webhooks/outbox/stats').then(r=>r.json()),
        fetch('/api/tenant/client-api/webhooks/outbox?limit=100').then(r=>r.json()),
      ]);
      setStats(statsRes);
      setRows(listRes);
    } catch (e:any) {
      setToast('فشل التحديث');
    } finally { setLoading(false); }
  }, []);

  useEffect(()=> { fetchAll(); }, [fetchAll]);
  useEffect(()=> {
    if (!autoRefresh) return; const id = setInterval(fetchAll, POLL_INTERVAL); return ()=> clearInterval(id);
  }, [autoRefresh, fetchAll]);

  const action = async (id: string, kind: 'retry'|'mark-dead'|'redeliver') => {
    try {
      const res = await fetch(`/api/tenant/client-api/webhooks/outbox/${id}/${kind}`, { method: 'POST' });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || 'error');
      setToast('تم التنفيذ بنجاح');
      fetchAll();
    } catch {
      setToast('فشل التنفيذ');
    }
  };

  return (
    <AdminShell title="Webhooks (Client API)">
      <div className="flex items-center gap-4 mb-4">
        <button className="btn btn-sm" onClick={fetchAll} disabled={loading}>تحديث</button>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)} /> Auto-refresh
        </label>
        {toast && <div className="text-sm text-green-600" onClick={()=>setToast(null)}>{toast}</div>}
      </div>
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6 text-sm">
          <Stat label="Pending" value={stats.pending} />
          <Stat label="Delivering" value={stats.delivering} />
          <Stat label="Failed" value={stats.failed} />
          <Stat label="Dead" value={stats.dead} />
          <Stat label="Succeeded" value={stats.succeeded} />
          <Stat label="Succeeded Today" value={stats.succeededToday} />
        </div>
      )}
      <div className="overflow-auto border rounded">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-100">
            <tr>
              <Th>ID</Th>
              <Th>Event</Th>
              <Th>Status</Th>
              <Th>Attempts</Th>
              <Th>Next Attempt</Th>
              <Th>Resp</Th>
              <Th>Error</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r=> <Row key={r.id} row={r} onAction={action} />)}
            {!rows.length && <tr><td colSpan={8} className="p-4 text-center text-gray-400">لا توجد بيانات</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Th({ children }: { children: React.ReactNode }) { return <th className="p-2 text-left font-medium border-b">{children}</th>; }
function Td({ children, className }: { children: React.ReactNode; className?: string }) { return <td className={`p-2 border-b align-top ${className||''}`}>{children}</td>; }

function Row({ row, onAction }: { row: OutboxRow; onAction: (id:string, kind:any)=>void }) {
  const [busy, setBusy] = React.useState(false);
  const run = (kind: 'retry'|'mark-dead'|'redeliver') => { setBusy(true); Promise.resolve(onAction(row.id, kind)).finally(()=> setBusy(false)); };
  return (
    <tr className={row.status === 'failed' ? 'bg-amber-50' : row.status==='dead' ? 'bg-red-50' : row.status==='succeeded' ? 'bg-green-50' : ''}>
      <Td><code className="text-[10px] break-all">{row.id}</code></Td>
      <Td>{row.event_type}</Td>
      <Td>{row.status}</Td>
      <Td>{row.attempt_count}</Td>
      <Td>{row.next_attempt_at ? new Date(row.next_attempt_at).toLocaleTimeString() : '-'}</Td>
      <Td>{row.response_code ?? '-'}</Td>
      <Td className="max-w-xs"><span title={row.last_error||''}>{row.last_error?.slice(0,80)}</span></Td>
      <Td>
        <div className="flex gap-1 flex-wrap">
          <button disabled={busy} onClick={()=>run('retry')} className="btn btn-xs">Retry</button>
          <button disabled={busy} onClick={()=>run('mark-dead')} className="btn btn-xs">Dead</button>
          <button disabled={busy} onClick={()=>run('redeliver')} className="btn btn-xs">Redeliver</button>
        </div>
      </Td>
    </tr>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 rounded border bg-white shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
