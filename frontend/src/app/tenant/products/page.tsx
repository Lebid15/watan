"use client";
import React, { useEffect, useState } from 'react';
import api, { API_ROUTES } from '@/utils/api';
import Link from 'next/link';
import { formatMoney3 } from '@/utils/format';

interface ProductRow {
  id: string;
  name: string;
  basePriceUsd?: number;
  capitalPriceUsd?: number;
}

export default function TenantProductsPage() {
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<any>(null);

  const isProduct = (v: any): v is ProductRow =>
    !!v && typeof v === 'object' && typeof v.id === 'string' && typeof v.name === 'string';

  const normalize = (raw: unknown): ProductRow[] => {
    if (Array.isArray(raw)) return raw.filter(isProduct);
    if (raw && typeof raw === 'object' && Array.isArray((raw as any).items))
      return (raw as any).items.filter(isProduct);
    return [];
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get(API_ROUTES.products.base);
        setRows(normalize((r as any)?.data));
      } catch (e: any) {
        setErr(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Products</h1>
        <Link href="/tenant/products/new" className="btn btn-sm btn-primary">
          New
        </Link>
      </div>
      {loading && <div>Loading...</div>}
      {err && <div className="text-danger text-sm">Failed loading</div>}
      <table className="w-full text-sm border border-border">
        <thead className="bg-bg-surface-alt">
          <tr>
            <th className="p-2 text-right">Name</th>
            <th className="p-2 text-right">Base</th>
            <th className="p-2 text-right">Capital</th>
            <th className="p-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-t border-border hover:bg-bg-surface-alt/60">
              <td className="p-2">{p.name}</td>
              <td className="p-2 font-mono" dir="ltr">{formatMoney3(p.basePriceUsd || 0)}</td>
              <td className="p-2 font-mono" dir="ltr">{formatMoney3(p.capitalPriceUsd || 0)}</td>
              <td className="p-2">
                <Link href={`/tenant/products/${p.id}`} className="link">Open</Link>
              </td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td className="p-4 text-center text-xs opacity-60" colSpan={4}>
                No products
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
