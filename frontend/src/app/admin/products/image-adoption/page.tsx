"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import ProductsNavbar from '../ProductsNavbar';

interface SnapshotRow { createdAt: string; custom: number; catalog: number; missing: number; }
interface DeltaData { customDiff: number; catalogDiff: number; missingDiff: number; baselineTimestamp?: string; latestTimestamp?: string; }

function formatDate(ts?: string) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

const TrendBadge: React.FC<{ diff: number }> = ({ diff }) => {
  if (diff === 0) return <span className="px-2 py-0.5 rounded bg-gray-300 text-gray-800 text-xs">0</span>;
  if (diff > 0) return <span className="px-2 py-0.5 rounded bg-emerald-200 text-emerald-800 text-xs">+{diff}</span>;
  return <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-800 text-xs">{diff}</span>;
};

export default function ImageAdoptionPage() {
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [delta, setDelta] = useState<DeltaData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [latestRes, deltaRes] = await Promise.all([
          fetch('/admin/products/image-metrics/latest').then(r => r.json()),
          fetch('/admin/products/image-metrics/delta').then(r => r.json()),
        ]);
        if (!cancelled) {
          setSnapshots(latestRes?.rows || []);
          setDelta(deltaRes?.delta || null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'فشل التحميل');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 60000); // refresh each minute
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const latest = snapshots[0];
  const total = latest ? latest.custom + latest.catalog + latest.missing : 0;
  const pct = (n: number) => (total ? ((n / total) * 100).toFixed(1) : '0.0');

  return (
    <div className="p-4 space-y-6">
      <ProductsNavbar />
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold">تحليل اعتماد صور المنتجات</h1>
        <Link href="/admin/products" className="text-sm text-blue-600 hover:underline">عودة للقائمة</Link>
      </div>

      {error && <div className="bg-rose-100 text-rose-800 p-3 rounded">{error}</div>}

      {loading && <div className="text-sm text-gray-500">جار التحميل...</div>}

      {latest && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded border bg-white shadow-sm">
            <h2 className="font-medium mb-2 flex items-center gap-2">صور مخصصة
              {delta && <TrendBadge diff={delta.customDiff} />}
            </h2>
            <div className="text-2xl font-bold">{latest.custom}</div>
            <div className="text-xs text-gray-500">{pct(latest.custom)}% من إجمالي المنتجات</div>
          </div>
          <div className="p-4 rounded border bg-white shadow-sm">
            <h2 className="font-medium mb-2 flex items-center gap-2">صور كتالوج
              {delta && <TrendBadge diff={delta.catalogDiff} />}
            </h2>
            <div className="text-2xl font-bold">{latest.catalog}</div>
            <div className="text-xs text-gray-500">{pct(latest.catalog)}% من الإجمالي</div>
          </div>
          <div className="p-4 rounded border bg-white shadow-sm">
            <h2 className="font-medium mb-2 flex items-center gap-2">بدون صورة
              {delta && <TrendBadge diff={delta.missingDiff} />}
            </h2>
            <div className="text-2xl font-bold">{latest.missing}</div>
            <div className="text-xs text-gray-500">{pct(latest.missing)}% من الإجمالي</div>
          </div>
        </div>
      )}

      {delta && (
        <div className="p-4 border rounded bg-white shadow-sm text-sm">
          <div className="font-medium mb-1">مقارنة يومية (قد تكون فارغة إذا لا توجد لقطات بفارق زمني كاف)</div>
          <div className="grid grid-cols-3 gap-2">
            <div><span className="text-gray-500">خط الأساس:</span> {formatDate(delta.baselineTimestamp)}</div>
            <div><span className="text-gray-500">أحدث لقطة:</span> {formatDate(delta.latestTimestamp)}</div>
            <div><span className="text-gray-500">إجمالي تغير:</span> مخصص <TrendBadge diff={delta.customDiff}/> كتالوج <TrendBadge diff={delta.catalogDiff}/> بدون <TrendBadge diff={delta.missingDiff}/></div>
          </div>
        </div>
      )}

      {snapshots.length > 0 && (
        <div className="p-4 border rounded bg-white shadow-sm">
          <h2 className="font-medium mb-2">السجل الزمني الأخير</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-start">الوقت</th>
                  <th className="p-2 text-start">مخصص</th>
                  <th className="p-2 text-start">كتالوج</th>
                  <th className="p-2 text-start">بدون</th>
                  <th className="p-2 text-start">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s, i) => {
                  const t = s.custom + s.catalog + s.missing;
                  return (
                    <tr key={i} className="odd:bg-white even:bg-gray-50 border-t">
                      <td className="p-2 whitespace-nowrap">{formatDate(s.createdAt)}</td>
                      <td className="p-2">{s.custom}</td>
                      <td className="p-2">{s.catalog}</td>
                      <td className="p-2">{s.missing}</td>
                      <td className="p-2 font-medium">{t}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
