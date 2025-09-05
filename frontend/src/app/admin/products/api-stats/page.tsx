"use client";
import React, { useEffect, useState } from 'react';

interface TodayStats { total:number; ok:number; [k:string]:any }
interface DayRow { date:string; total:number; ok:number; code_120?:number; code_121?:number; code_122?:number; code_123?:number; code_100?:number; code_110?:number; code_429?:number; }
interface TopErr { code:number; count:number }
interface LogRow { id:string; path:string; method:string; code:number; ip?:string|null; createdAt:string }

export default function ClientApiStatsPage() {
  const [today, setToday] = useState<TodayStats|null>(null);
  const [last7d, setLast7d] = useState<DayRow[]>([]);
  const [top, setTop] = useState<TopErr[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  async function load() {
    try {
      setLoading(true);
      const [a,b,c,d] = await Promise.all([
        fetch('/api/tenant/client-api/stats/today').then(r=>r.json()),
        fetch('/api/tenant/client-api/stats/last7d').then(r=>r.json()),
        fetch('/api/tenant/client-api/stats/top-errors?limit=5').then(r=>r.json()),
        fetch('/api/tenant/client-api/logs/recent?limit=20').then(r=>r.json()),
      ]);
      setToday(a); setLast7d(b); setTop(c); setLogs(d);
    } catch(e) {
      setError('Failed to load');
    } finally { setLoading(false); }
  }

  useEffect(()=>{ load(); },[]);

  function num(n:any){ return typeof n==='number'? n: 0; }

  return <div className="p-4 space-y-6 max-w-6xl">
    <div className="flex items-center justify-between">
      <h1 className="text-xl font-semibold">Client API Stats</h1>
      <button onClick={load} className="px-3 py-1 text-sm border rounded">Refresh</button>
    </div>
    {error && <div className="text-red-600 text-sm">{error}</div>}
    {loading && <div className="text-sm">Loading...</div>}
    {today && !loading && (
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {[
          { label:'Today Total', value: today.total },
          { label:'OK', value: today.ok },
          { label:'429', value: today.code_429 || 0 },
          { label:'120', value: today.code_120 || 0 },
          { label:'121', value: today.code_121 || 0 },
          { label:'123', value: today.code_123 || 0 },
          { label:'100', value: today.code_100 || 0 },
        ].map(c=> <div key={c.label} className="bg-white shadow rounded p-3">
          <div className="text-xs uppercase text-gray-500">{c.label}</div>
          <div className="text-lg font-semibold">{c.value}</div>
        </div>)}
      </div>
    )}

    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Last 7 Days (Totals)</h2>
      <div className="flex gap-2 overflow-x-auto text-xs">
        {last7d.map(d=> <div key={d.date} className="min-w-[90px] bg-gray-100 rounded p-2 text-center">
          <div className="font-medium">{d.total}</div>
          <div className="text-[10px] text-gray-500">{d.date.slice(5)}</div>
        </div>)}
      </div>
    </section>

    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Top Errors (Today)</h2>
      <table className="w-full text-xs border">
        <thead className="bg-gray-50">
          <tr><th className="p-1 border">Code</th><th className="p-1 border">Count</th></tr>
        </thead>
        <tbody>
          {top.length===0 && <tr><td colSpan={2} className="p-2 text-center text-gray-500">None</td></tr>}
          {top.map(r=> <tr key={r.code}> <td className="p-1 border font-mono">{r.code}</td><td className="p-1 border">{r.count}</td></tr>)}
        </tbody>
      </table>
    </section>

    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Last 20 Requests</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-1 border">Time</th>
              <th className="p-1 border">Method</th>
              <th className="p-1 border">Path</th>
              <th className="p-1 border">IP</th>
              <th className="p-1 border">Code</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l=> <tr key={l.id} className="hover:bg-gray-50">
              <td className="p-1 border whitespace-nowrap">{new Date(l.createdAt).toLocaleTimeString()}</td>
              <td className="p-1 border">{l.method}</td>
              <td className="p-1 border font-mono max-w-[260px] truncate" title={l.path}>{l.path}</td>
              <td className="p-1 border">{l.ip || ''}</td>
              <td className="p-1 border text-center">{l.code}</td>
            </tr>)}
            {logs.length===0 && <tr><td colSpan={5} className="p-2 text-center text-gray-500">No data</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
