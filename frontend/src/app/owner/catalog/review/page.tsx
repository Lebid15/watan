"use client";
import React, { useEffect, useState } from 'react';
import api from '@/utils/api';

interface Candidate {
  id: string;
  name: string;
  queued?: boolean;
}

export default function CatalogReviewPublish() {
  const [rows, setRows] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<any>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const isCandidate = (v: any): v is Candidate =>
    !!v && typeof v === 'object' && typeof v.id === 'string' && typeof v.name === 'string';

  const normalize = (raw: unknown): Candidate[] => {
    if (Array.isArray(raw)) return raw.filter(isCandidate);
    if (raw && typeof raw === 'object') {
      const items = (raw as any).items;
      if (Array.isArray(items)) return items.filter(isCandidate);
    }
    return [];
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/owner/catalog/publish-queue');
        const list = normalize((r as any)?.data);
        setRows(list);
      } catch (e: any) {
        setErr(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));

  const publish = async () => {
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!ids.length) return;
    await api.post('/owner/catalog/publish', { ids });
    alert('Published (stub)');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Catalog Review & Publish</h1>
      {loading && <div>Loading...</div>}
      {err && <div className="text-danger text-sm">Failed loading</div>}
      <div>
        <button
          disabled={!Object.values(selected).some(Boolean)}
          onClick={publish}
          className="btn btn-sm btn-primary"
        >
          Publish Selected
        </button>
      </div>
      <table className="w-full text-sm border border-border">
        <thead className="bg-bg-surface-alt">
          <tr>
            <th className="p-2"></th>
            <th className="p-2 text-right">Name</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-border">
              <td className="p-2">
                <input
                  type="checkbox"
                  checked={!!selected[r.id]}
                  onChange={() => toggle(r.id)}
                />
              </td>
              <td className="p-2">{r.name}</td>
            </tr>
          ))}
          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={2} className="p-4 text-center opacity-60">
                No queued items
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
