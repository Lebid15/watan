"use client";
import React, { useEffect, useState } from 'react';
import api from '@/utils/api';
import { formatMoney3 } from '@/utils/format';

interface ProfitRow {
  id: string;
  orderId: string;
  capitalUsd: number;
  sellUsd: number;
  createdAt: string;
}

export default function TenantReportsPage() {
  const [rows, setRows] = useState<ProfitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<any>(null);
  const [page, setPage] = useState(0);
  const limit = 20;

  const isProfitRow = (v: any): v is ProfitRow =>
    !!v && typeof v === 'object' && typeof v.id === 'string';

  const normalize = (raw: unknown): ProfitRow[] => {
    if (Array.isArray(raw)) return raw.filter(isProfitRow);
    if (raw && typeof raw === 'object' && Array.isArray((raw as any).items))
      return (raw as any).items.filter(isProfitRow);
    return [];
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api.get(`/tenant/reports/profits?limit=${limit}&offset=${page * limit}`);
        setRows(normalize((r as any)?.data));
      } catch (e: any) {
        setErr(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [page]);

  const capTotal = rows.reduce((s, r) => s + (r.capitalUsd || 0), 0);
  const sellTotal = rows.reduce((s, r) => s + (r.sellUsd || 0), 0);
  const profitTotal = sellTotal - capTotal;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Reports</h1>
      {loading && <div>Loading...</div>}
      {err && <div className="text-danger text-sm">Failed loading</div>}
      <table className="w-full text-sm border border-border">
        <thead className="bg-bg-surface-alt">
          <tr>
            <th className="p-2 text-right">Order</th>
            <th className="p-2 text-right">Capital</th>
            <th className="p-2 text-right">Sell</th>
            <th className="p-2 text-right">Profit</th>
            <th className="p-2 text-right">Date</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="p-2 font-mono" dir="ltr">{r.orderId}</td>
              <td className="p-2 font-mono" dir="ltr">{formatMoney3(r.capitalUsd)}</td>
              <td className="p-2 font-mono" dir="ltr">{formatMoney3(r.sellUsd)}</td>
              <td className="p-2 font-mono" dir="ltr">
                {formatMoney3((r.sellUsd || 0) - (r.capitalUsd || 0))}
              </td>
              <td className="p-2 text-xs" dir="ltr">
                {r.createdAt?.slice(0, 19).replace('T', ' ')}
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={5} className="p-4 text-center opacity-60">
                No rows
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="flex items-center gap-3 text-xs">
        <button
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          className="btn btn-xs"
        >
          Prev
        </button>
        <span>Page {page + 1}</span>
        <button
          disabled={rows.length < limit}
          onClick={() => setPage((p) => p + 1)}
          className="btn btn-xs"
        >
          Next
        </button>
        <div className="ml-auto flex gap-4 font-mono" dir="ltr">
          <span>ΣCap {formatMoney3(capTotal)}</span>
          <span>ΣSell {formatMoney3(sellTotal)}</span>
          <span>ΣProfit {formatMoney3(profitTotal)}</span>
        </div>
      </div>
    </div>
  );
}
